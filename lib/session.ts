import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'peerline_session';
const STATE_COOKIE = 'peerline_oauth_state';

interface SessionPayload {
  accessToken: string;
  expiresAt: number;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }

  return createHash('sha256').update(secret).digest();
}

function encrypt(payload: SessionPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

function decrypt(value: string): SessionPayload | null {
  try {
    const bytes = Buffer.from(value, 'base64url');
    const iv = bytes.subarray(0, 12);
    const authTag = bytes.subarray(12, 28);
    const encrypted = bytes.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(decrypted) as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSession(
  accessToken: string,
  expiresInSeconds: number,
): Promise<void> {
  const store = await cookies();
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  store.set(
    SESSION_COOKIE,
    encrypt({ accessToken, expiresAt }),
    cookieOptions(expiresInSeconds),
  );
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  const payload = decrypt(value);

  if (!payload || payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload;
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', cookieOptions(0));
}

export async function createOAuthState(): Promise<string> {
  const state = randomBytes(32).toString('base64url');
  const store = await cookies();
  store.set(STATE_COOKIE, state, cookieOptions(10 * 60));
  return state;
}

export async function verifyOAuthState(received: string): Promise<boolean> {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.set(STATE_COOKIE, '', cookieOptions(0));

  if (!expected) {
    return false;
  }

  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);

  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}
