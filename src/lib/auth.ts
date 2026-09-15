import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db, UserRecord } from './db';

const SESSION_COOKIE = 'speedating_session';
const INTENT_COOKIE = 'speedating_intent';
const COOKIE_SECRET = process.env.SESSION_SECRET || 'speedating_nostalgic_auth_secret_phase1_2026';

function signValue(val: string): string {
  const hmac = crypto.createHmac('sha256', COOKIE_SECRET).update(val).digest('hex');
  return `${val}.${hmac}`;
}

function verifyValue(signedVal: string): string | null {
  const parts = signedVal.split('.');
  if (parts.length !== 2) return null;
  const [val, signature] = parts;
  const expectedHmac = crypto.createHmac('sha256', COOKIE_SECRET).update(val).digest('hex');
  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))) {
    return val;
  }
  return null;
}

export async function setPendingIntent(intent: string = 'video') {
  const cookieStore = await cookies();
  const signed = signValue(intent);
  cookieStore.set(INTENT_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
    path: '/',
  });
}

export async function getPendingIntent(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(INTENT_COOKIE);
  if (!cookie?.value) return null;
  return verifyValue(cookie.value);
}

export async function clearPendingIntent() {
  const cookieStore = await cookies();
  cookieStore.delete(INTENT_COOKIE);
}

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  const signed = signValue(userId);
  cookieStore.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function getSessionUser(): Promise<UserRecord | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE);
    if (!cookie?.value) return null;

    const userId = verifyValue(cookie.value);
    if (!userId) return null;

    const user = await db.queryOne<UserRecord>(
      'SELECT id, email, status, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (!user || user.status === 'BANNED') {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(INTENT_COOKIE);
}

export async function getOrCreateUser(email: string): Promise<UserRecord> {
  const normalizedEmail = email.toLowerCase().trim();
  let user = await db.queryOne<UserRecord>(
    'SELECT id, email, status, created_at, updated_at FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (!user) {
    const created = await db.query<UserRecord>(
      `INSERT INTO users (email, status) 
       VALUES ($1, 'ACTIVE') 
       RETURNING id, email, status, created_at, updated_at`,
      [normalizedEmail]
    );
    user = created[0];
  }

  return user;
}
