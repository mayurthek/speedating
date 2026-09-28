import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db, UserRecord, ProfileRecord, PreferenceRecord } from './db';
import { fakeVerifyDelay } from './password';
import { checkProfileCompletion } from './profile-validation';

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

const USER_COLUMNS = 'id, email, status, created_at, updated_at';

export interface AuthPayload {
  user: { id: string; email: string; status: UserRecord['status'] };
  profile: ProfileRecord | null;
  preference: PreferenceRecord | null;
  profileComplete: boolean;
  missingFields: string[];
}

/** Shared response body for both login and register so clients can branch identically. */
export async function getAuthPayload(user: UserRecord): Promise<AuthPayload> {
  const [profile, preference] = await Promise.all([
    db.queryOne<ProfileRecord>('SELECT * FROM profiles WHERE user_id = $1', [user.id]),
    db.queryOne<PreferenceRecord>('SELECT * FROM preferences WHERE user_id = $1', [user.id]),
  ]);

  const completion = checkProfileCompletion({
    firstName: profile?.first_name,
    dateOfBirth: profile?.date_of_birth,
    gender: profile?.gender,
    avatarType: profile?.avatar_type,
    interestedIn: preference?.interested_in,
  });

  return {
    user: { id: user.id, email: user.email, status: user.status },
    profile,
    preference,
    profileComplete: completion.isComplete,
    missingFields: completion.missingFields,
  };
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return db.queryOne<UserRecord>(
    `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
    [normalizeEmail(email)]
  );
}

/**
 * Create a brand new account. Fails if the email is already taken.
 */
export async function registerUser(email: string, passwordHash: string): Promise<UserRecord | null> {
  const created = await db.query<UserRecord>(
    `INSERT INTO users (email, status, password_hash)
     VALUES ($1, 'ACTIVE', $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING ${USER_COLUMNS}`,
    [normalizeEmail(email), passwordHash]
  );

  return created[0] ?? null;
}

/**
 * Verify email + password.
 *
 * Returns null for every failure mode (unknown email, wrong password, account
 * without a password, banned account) so callers cannot use it to enumerate
 * which emails are registered. The not-found path burns equivalent CPU.
 */
export async function authenticateUser(
  email: string,
  password: string,
  verify: (password: string, stored: string) => Promise<boolean>
): Promise<UserRecord | null> {
  const user = await db.queryOne<UserRecord & { password_hash: string | null }>(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [normalizeEmail(email)]
  );

  if (!user || !user.password_hash) {
    await fakeVerifyDelay(password);
    return null;
  }

  const passwordMatches = await verify(password, user.password_hash);
  if (!passwordMatches || user.status === 'BANNED') {
    return null;
  }

  return user;
}
