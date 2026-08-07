import {
  fetchAllFortyTwo,
  getCurrentUser,
  getCursusUsers,
  getUser,
} from '@/lib/forty-two-api';
import type {
  CohortDashboardData,
  FortyTwoCursusUser,
  FortyTwoUser,
  PeerDetail,
  PeerStatus,
} from '@/lib/forty-two-types';
import {
  normalizePoolMonth,
  normalizePoolYear,
  poolYearOptions,
  POOL_MONTHS,
  type CohortPool,
  type PoolMonthOption,
} from '@/lib/pool';

function userImage(user: FortyTwoUser): string | null {
  return (
    user.image?.versions?.medium ??
    user.image?.link ??
    user.image_url ??
    null
  );
}

function getPrimaryCampus(user: FortyTwoUser) {
  const campusUser = user.campus_users?.find((item) => item.is_primary);
  const campusId = campusUser?.campus_id ?? user.campus?.[0]?.id ?? null;
  const campus =
    user.campus?.find((item) => item.id === campusId) ?? user.campus?.[0];

  return {
    id: campusId,
    name: campus?.name ?? 'Campus',
  };
}

function getCoreCursus(user: FortyTwoUser): FortyTwoCursusUser | null {
  const cursusUsers = user.cursus_users ?? [];
  const exact = cursusUsers.find(
    (item) => item.cursus.slug.toLowerCase() === '42cursus',
  );

  if (exact) {
    return exact;
  }

  return (
    cursusUsers
      .filter((item) => !item.cursus.slug.toLowerCase().includes('piscine'))
      .sort((left, right) => {
        const leftActive = left.end_at ? 0 : 1;
        const rightActive = right.end_at ? 0 : 1;
        return rightActive - leftActive || right.level - left.level;
      })[0] ?? null
  );
}

// 42 APIはフリーズ状態を公開していない。フリーズ中はactive?がfalseになり、
// blackholed_atは止まったまま過去日付になるため、blackholed_at単体では
// Blackhole到達と区別できない。判定順は次のとおり。
//
// - end_atあり(cursusが閉じられた)の非alumniはBlackhole到達扱い。
//   自主離脱との区別は公開データからはつけられない。
// - end_atなしでactive?がfalseならフリーズ中。
// - end_atなしでactive?がtrueなら、blackholed_atが過去でも基本は在籍中。
//   APIのblackholed_atは更新が遅れることがあり、期限を過ぎていても
//   実際には在籍しているケースが多い(期限の20日後に活動している例もある)。
//   期限超過に加えて半年以上活動がない場合だけBlackhole到達とみなす。
const INACTIVE_GRACE_MS = 180 * 24 * 60 * 60 * 1000;

function peerStatus(
  user: FortyTwoUser,
  cursusUser: FortyTwoCursusUser | undefined,
  now: number,
): PeerStatus {
  if (!cursusUser) {
    return 'not-enrolled';
  }

  if (user['alumni?'] || user.alumnized_at) {
    return 'ended';
  }

  if (cursusUser.end_at) {
    return cursusUser.blackholed_at ? 'blackholed' : 'ended';
  }

  if (user['active?'] === false) {
    return 'frozen';
  }

  const blackholedAt = cursusUser.blackholed_at
    ? Date.parse(cursusUser.blackholed_at)
    : Number.NaN;

  if (!Number.isFinite(blackholedAt) || blackholedAt > now) {
    return 'active';
  }

  const lastActivityAt = user.updated_at
    ? Date.parse(user.updated_at)
    : Number.NaN;

  if (
    Number.isFinite(lastActivityAt) &&
    (lastActivityAt > blackholedAt ||
      now - lastActivityAt < INACTIVE_GRACE_MS)
  ) {
    return 'active';
  }

  return 'blackholed';
}

// 42 APIは1リクエストにつき0.5秒以上あける必要があるため、リクエスト数が
// そのまま待ち時間になる。取得済みの結果はプロセス内に保持して使い回す。
const VIEWER_TTL_MS = 15 * 60 * 1000;
const YEAR_USERS_TTL_MS = 15 * 60 * 1000;
const CURSUS_USERS_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const cacheStore = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const entry = cacheStore.get(key);

  if (entry && entry.expiresAt > Date.now()) {
    return entry.value as T;
  }

  const running = inflight.get(key);

  if (running) {
    return running as Promise<T>;
  }

  const pending = load()
    .then((value) => {
      cacheStore.set(key, { expiresAt: Date.now() + ttlMs, value });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, pending);

  return pending as Promise<T>;
}

// 年単位でまとめて取得しておき、月の絞り込みと月ごとの人数集計は
// ローカルで行う。月ごとにAPIを叩くよりリクエスト数が少なく済む。
function getPoolMonthOptions(users: FortyTwoUser[]): PoolMonthOption[] {
  const counts = new Map<string, number>();

  for (const user of users) {
    const month = user.pool_month?.toLowerCase();

    if (month) {
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
  }

  return POOL_MONTHS.filter((month) => counts.has(month)).map((month) => ({
    month,
    count: counts.get(month) ?? 0,
  }));
}

export function clearCohortCache(): void {
  cacheStore.clear();
}

export async function getCohortDashboard(
  accessToken: string,
  requestedPool: Partial<CohortPool> | null,
): Promise<CohortDashboardData> {
  const viewer = await cached('viewer', VIEWER_TTL_MS, () =>
    getCurrentUser(accessToken),
  );
  const viewerPoolYear = normalizePoolYear(viewer.pool_year);
  const viewerPoolMonth = normalizePoolMonth(viewer.pool_month);

  if (!viewerPoolYear || !viewerPoolMonth) {
    throw new Error(
      '42プロフィールにPiscineの年月が登録されていません。',
    );
  }

  const poolYear = normalizePoolYear(requestedPool?.year) ?? viewerPoolYear;
  const primaryCampus = getPrimaryCampus(viewer);
  const coreCursus = getCoreCursus(viewer);
  const yearSnapshot = await cached(
    'users:' + primaryCampus.id + ':' + poolYear,
    YEAR_USERS_TTL_MS,
    async () => ({
      fetchedAt: new Date().toISOString(),
      users: await fetchAllFortyTwo<FortyTwoUser>('/v2/users', accessToken, {
        'filter[pool_year]': poolYear,
        'filter[kind]': 'student',
        'filter[primary_campus_id]': primaryCampus.id,
        sort: 'login',
      }),
    }),
  );
  const yearUsers = yearSnapshot.users;
  const monthOptions = getPoolMonthOptions(yearUsers);
  const requestedMonth =
    normalizePoolMonth(requestedPool?.month) ?? viewerPoolMonth;
  const hasRequestedMonth = monthOptions.some(
    (option) => option.month === requestedMonth,
  );
  // 年を切り替えたときにその月のPiscineがなければ、その年の先頭の月に寄せる。
  const poolMonth =
    hasRequestedMonth || monthOptions.length === 0
      ? requestedMonth
      : monthOptions[0].month;
  const users = yearUsers.filter(
    (user) => user.pool_month?.toLowerCase() === poolMonth,
  );
  const cursusUsers = coreCursus
    ? await cached(
        'cursus:' +
          coreCursus.cursus_id +
          ':' +
          primaryCampus.id +
          ':' +
          poolYear +
          ':' +
          poolMonth,
        CURSUS_USERS_TTL_MS,
        () =>
          getCursusUsers(
            accessToken,
            coreCursus.cursus_id,
            users.map((user) => user.id),
          ),
      )
    : [];
  const cursusByUser = new Map(
    cursusUsers.map((item) => [item.user.id, item]),
  );

  const now = Date.now();

  return {
    viewer: {
      login: viewer.login,
      name: viewer.usual_full_name ?? viewer.displayname,
      image: userImage(viewer),
    },
    cohort: {
      poolMonth,
      poolYear,
      campusId: primaryCampus.id,
      campusName: primaryCampus.name,
      cursusId: coreCursus?.cursus_id ?? null,
      viewerPoolMonth,
      viewerPoolYear,
      yearOptions: poolYearOptions(viewerPoolYear),
      monthOptions,
    },
    peers: users.map((user) => {
      const cursusUser = cursusByUser.get(user.id);

      return {
        id: user.id,
        login: user.login,
        name: user.usual_full_name ?? user.displayname,
        image: userImage(user),
        level: cursusUser?.level ?? null,
        grade: cursusUser?.grade ?? null,
        status: peerStatus(user, cursusUser, now),
        isOnCampus: Boolean(user.location),
        blackholedAt: cursusUser?.blackholed_at ?? null,
        beginAt: cursusUser?.begin_at ?? null,
      };
    }),
    generatedAt: yearSnapshot.fetchedAt,
  };
}

export async function getPeerDetail(
  accessToken: string,
  login: string,
  cursusId: number | null,
): Promise<PeerDetail> {
  const user = await getUser(accessToken, login);
  const cursusUser =
    user.cursus_users?.find((item) => item.cursus_id === cursusId) ?? null;
  const projects = (user.projects_users ?? [])
    .filter(
      (item) =>
        cursusId === null ||
        !item.cursus_ids ||
        item.cursus_ids.includes(cursusId),
    )
    .sort((left, right) => {
      if (left.status === 'in_progress' && right.status !== 'in_progress') {
        return -1;
      }

      if (right.status === 'in_progress' && left.status !== 'in_progress') {
        return 1;
      }

      return (
        Date.parse(right.updated_at ?? right.created_at ?? '1970-01-01') -
        Date.parse(left.updated_at ?? left.created_at ?? '1970-01-01')
      );
    })
    .map((item) => ({
      id: item.id,
      name: item.project.name,
      status: item.status,
      finalMark: item.final_mark,
      validated: item['validated?'] ?? null,
      updatedAt: item.updated_at ?? item.created_at ?? null,
    }));

  return {
    login: user.login,
    name: user.usual_full_name ?? user.displayname,
    image: userImage(user),
    level: cursusUser?.level ?? null,
    grade: cursusUser?.grade ?? null,
    isOnCampus: Boolean(user.location),
    projects,
  };
}
