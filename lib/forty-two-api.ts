import type {
  FortyTwoCursusUser,
  FortyTwoProjectUser,
  FortyTwoUser,
} from '@/lib/forty-two-types';

const API_ORIGIN = 'https://api.intra.42.fr';
const REQUEST_INTERVAL_MS = 600;
const REQUEST_TIMEOUT_MS = 30_000;
// 同時実行を増やしすぎると42 APIのスパム判定(429)に当たる。
const MAX_INFLIGHT_REQUESTS = 2;

let requestChain: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;
let inflightRequests = 0;
const slotWaiters: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inflightRequests < MAX_INFLIGHT_REQUESTS) {
    inflightRequests += 1;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    slotWaiters.push(() => {
      inflightRequests += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  inflightRequests -= 1;
  slotWaiters.shift()?.();
}

export class FortyTwoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'FortyTwoApiError';
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function scheduleFetch(url: URL, init: RequestInit): Promise<Response> {
  let release: () => void = () => undefined;
  const previous = requestChain;
  requestChain = new Promise<void>((resolve) => {
    release = resolve;
  });

  return previous.then(async () => {
    const waitFor = Math.max(
      0,
      REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt),
    );

    if (waitFor > 0) {
      await wait(waitFor);
    }

    lastRequestStartedAt = Date.now();
    release();
    await acquireSlot();

    try {
      return await fetch(url, init);
    } finally {
      releaseSlot();
    }
  });
}

function makeUrl(
  path: string,
  params: Record<string, string | number | null | undefined> = {},
): URL {
  const url = new URL(path, API_ORIGIN);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function extractErrorMessage(body: unknown): string {
  if (
    body &&
    typeof body === 'object' &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }

  return '42 API request failed.';
}

export async function fetchFortyTwo<T>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | null | undefined> = {},
): Promise<{ data: T; headers: Headers }> {
  const url = makeUrl(path, params);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;

    try {
      response = await scheduleFetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // タイムアウトや一時的な通信断はリトライする。
      if (attempt < 2) {
        await wait(500 * (attempt + 1));
        continue;
      }

      throw new FortyTwoApiError(
        error instanceof Error
          ? '42 APIに接続できませんでした: ' + error.message
          : '42 APIに接続できませんでした。',
        503,
      );
    }

    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get('retry-after') ?? 1);
      await wait(Math.max(1, retryAfter) * 1000);
      continue;
    }

    if (!response.ok) {
      let body: unknown = null;

      try {
        body = await response.json();
      } catch {
        body = null;
      }

      throw new FortyTwoApiError(
        extractErrorMessage(body),
        response.status,
      );
    }

    return {
      data: (await response.json()) as T,
      headers: response.headers,
    };
  }

  throw new FortyTwoApiError('42 API rate limit exceeded.', 429);
}

// 1ページ目のX-Totalから総ページ数を求め、残りは同時に投げる。
// 42 APIは1レスポンスに数秒かかるため、直列に取ると待ち時間が積み上がる。
export async function fetchAllFortyTwo<T>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | null | undefined> = {},
  maxPages = 20,
): Promise<T[]> {
  const pageSize = 100;
  const first = await fetchFortyTwo<T[]>(path, accessToken, {
    ...params,
    'page[number]': 1,
    'page[size]': pageSize,
  });

  if (first.data.length < pageSize) {
    return first.data;
  }

  const total = Number(first.headers.get('x-total') ?? '0');
  const pageCount = Number.isFinite(total)
    ? Math.min(maxPages, Math.max(1, Math.ceil(total / pageSize)))
    : 1;

  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      fetchFortyTwo<T[]>(path, accessToken, {
        ...params,
        'page[number]': index + 2,
        'page[size]': pageSize,
      }).then((page) => page.data),
    ),
  );

  return [first.data, ...rest].flat();
}

export async function getCurrentUser(
  accessToken: string,
): Promise<FortyTwoUser> {
  const { data } = await fetchFortyTwo<FortyTwoUser>(
    '/v2/me',
    accessToken,
  );
  return data;
}

export async function getUser(
  accessToken: string,
  login: string,
): Promise<FortyTwoUser> {
  const { data } = await fetchFortyTwo<FortyTwoUser>(
    '/v2/users/' + encodeURIComponent(login),
    accessToken,
  );
  return data;
}

export async function getCursusUsers(
  accessToken: string,
  cursusId: number,
  userIds: number[],
): Promise<FortyTwoCursusUser[]> {
  if (userIds.length === 0) {
    return [];
  }

  const chunks: number[][] = [];

  for (let index = 0; index < userIds.length; index += 100) {
    chunks.push(userIds.slice(index, index + 100));
  }

  const pages = await Promise.all(
    chunks.map((chunk) =>
      fetchFortyTwo<FortyTwoCursusUser[]>(
        '/v2/cursus/' + cursusId + '/cursus_users',
        accessToken,
        {
          'filter[user_id]': chunk.join(','),
          'page[size]': 100,
        },
      ).then((page) => page.data),
    ),
  );

  return pages.flat();
}

// 指定期間に採点されたプロジェクトを、ユーザーIDをまとめて絞り込んで取る。
// レスポンスにuser(login)が入るので、ユーザーごとの追加取得は不要。
export async function getProjectSubmissions(
  accessToken: string,
  cursusId: number,
  userIds: number[],
  since: Date,
): Promise<FortyTwoProjectUser[]> {
  if (userIds.length === 0) {
    return [];
  }

  const range = since.toISOString() + ',' + new Date().toISOString();
  const chunks: number[][] = [];

  for (let index = 0; index < userIds.length; index += 100) {
    chunks.push(userIds.slice(index, index + 100));
  }

  const pages = await Promise.all(
    chunks.map((chunk) =>
      fetchAllFortyTwo<FortyTwoProjectUser>(
        '/v2/projects_users',
        accessToken,
        {
          'filter[user_id]': chunk.join(','),
          'filter[cursus]': cursusId,
          'range[marked_at]': range,
          sort: '-marked_at',
        },
        5,
      ),
    ),
  );

  return pages.flat();
}
