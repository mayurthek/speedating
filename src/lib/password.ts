import crypto from 'crypto';

// Password hashing with scrypt (node:crypto, no external dependency).
// Parameters follow the OWASP Password Storage Cheat Sheet recommendation.
// Memory cost is 128 * N * r bytes = 16 MiB at N=16384, r=8.

// Bounds are enforced when reading a stored hash so a tampered database row
// cannot request an unbounded allocation and take the process down.
const MAX_ALLOWED_N = 1 << 20;
const MAX_ALLOWED_R = 32;

const SCHEME = 'scrypt';

interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  params: ScryptParams
): Promise<Buffer> {
  const maxmem = 256 * params.N * params.r * params.p;
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      keylen,
      { N: params.N, r: params.r, p: params.p, maxmem },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const params: ScryptParams = { N: 16384, r: 8, p: 1 };
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password.normalize('NFKC'), salt, 64, params);

  return [
    SCHEME,
    params.N,
    params.r,
    params.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Verify a password against a stored hash. Returns false rather than throwing
 * for any malformed or unsupported input.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof stored !== 'string' || stored.length === 0) return false;

  const parts = stored.split('$');
  if (parts.length !== 6) return false;

  const [scheme, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  if (scheme !== SCHEME) return false;

  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N <= 1 || N > MAX_ALLOWED_N || r <= 0 || r > MAX_ALLOWED_R || p <= 0) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    // Key length is taken from the stored digest so timingSafeEqual never
    // receives two buffers of differing length.
    const actual = await scryptAsync(password.normalize('NFKC'), salt, expected.length, { N, r, p });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * Burn roughly the same CPU as a real verification. Called when the account does
 * not exist so that "unknown email" and "wrong password" take similar time and
 * cannot be told apart by a stopwatch.
 */
export async function fakeVerifyDelay(password: string): Promise<void> {
  try {
    await scryptAsync(password.normalize('NFKC'), crypto.randomBytes(16), 64, { N: 16384, r: 8, p: 1 });
  } catch {
    // Timing defence only; failure here is irrelevant.
  }
}
