import { db, ProfileRecord, PreferenceRecord, QueueEntryRecord, SessionRecord, UserRecord } from './db';
import { checkProfileCompletion } from './profile-validation';

// Helper to check mutual compatibility between two users
export function areCompatible(
  userA: { gender: string; interestedIn: string },
  userB: { gender: string; interestedIn: string }
): boolean {
  // A accepts B
  const aAcceptsB =
    userA.interestedIn === 'Everyone' ||
    (userA.interestedIn === 'Men' && userB.gender === 'Man') ||
    (userA.interestedIn === 'Women' && userB.gender === 'Woman');

  // B accepts A
  const bAcceptsA =
    userB.interestedIn === 'Everyone' ||
    (userB.interestedIn === 'Men' && userA.gender === 'Man') ||
    (userB.interestedIn === 'Women' && userA.gender === 'Woman');

  return aAcceptsB && bAcceptsA;
}

// In-memory mutex to ensure atomic matchmaking transitions and prevent race conditions
let isMatchmakingLocked = false;
const matchmakingQueue: (() => void)[] = [];

async function acquireLock(): Promise<void> {
  if (!isMatchmakingLocked) {
    isMatchmakingLocked = true;
    return;
  }
  return new Promise((resolve) => {
    matchmakingQueue.push(resolve);
  });
}

function releaseLock(): void {
  if (matchmakingQueue.length > 0) {
    const next = matchmakingQueue.shift();
    next?.();
  } else {
    isMatchmakingLocked = false;
  }
}

export async function joinQueue(userId: string): Promise<{
  status: 'WAITING' | 'MATCHED';
  sessionId?: string;
  partner?: { firstName: string; avatarType: string };
}> {
  // 1. Verify User Eligibility & Profile Completion
  const user = await db.queryOne<UserRecord>('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user || user.status !== 'ACTIVE') {
    throw new Error('User is not eligible or suspended');
  }

  const profile = await db.queryOne<ProfileRecord>('SELECT * FROM profiles WHERE user_id = $1', [userId]);
  const preference = await db.queryOne<PreferenceRecord>('SELECT * FROM preferences WHERE user_id = $1', [userId]);

  const completion = checkProfileCompletion({
    firstName: profile?.first_name,
    dateOfBirth: profile?.date_of_birth,
    gender: profile?.gender,
    avatarType: profile?.avatar_type,
    interestedIn: preference?.interested_in,
  });

  if (!completion.isComplete) {
    throw new Error(`Profile incomplete: ${completion.missingFields.join(', ')}`);
  }

  // 2. Prevent joining if already in active/matched session
  const activeSession = await db.queryOne<SessionRecord>(
    `SELECT * FROM sessions 
     WHERE (user_a = $1 OR user_b = $1) 
       AND status IN ('MATCHED', 'CONNECTING', 'ACTIVE')
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (activeSession) {
    return {
      status: 'MATCHED',
      sessionId: activeSession.id,
    };
  }

  await acquireLock();
  try {
    // 3. Upsert queue entry with status = WAITING
    await db.query(
      `INSERT INTO queue_entries (user_id, status, session_id, joined_at, last_ping_at)
       VALUES ($1, 'WAITING', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET status = 'WAITING', session_id = NULL, joined_at = CURRENT_TIMESTAMP, last_ping_at = CURRENT_TIMESTAMP`,
      [userId]
    );

    // 4. Find all candidate waiting peers (ordered by longest waiting first)
    const candidates = await db.query<{
      user_id: string;
      gender: string;
      avatar_type: string;
      first_name: string;
      interested_in: string;
      joined_at: string;
    }>(
      `SELECT q.user_id, p.gender, p.avatar_type, p.first_name, pr.interested_in, q.joined_at
       FROM queue_entries q
       JOIN profiles p ON p.user_id = q.user_id
       JOIN preferences pr ON pr.user_id = q.user_id
       WHERE q.status = 'WAITING'
         AND q.user_id != $1
       ORDER BY q.joined_at ASC`,
      [userId]
    );

    for (const candidate of candidates) {
      const candidateId = candidate.user_id;

      // Check mutual compatibility
      if (
        !areCompatible(
          { gender: profile!.gender, interestedIn: preference!.interested_in },
          { gender: candidate.gender, interestedIn: candidate.interested_in }
        )
      ) {
        continue;
      }

      // Check blocks (either direction)
      const block = await db.queryOne(
        `SELECT id FROM blocks 
         WHERE (user_id = $1 AND blocked_user_id = $2)
            OR (user_id = $2 AND blocked_user_id = $1)`,
        [userId, candidateId]
      );
      if (block) continue;

      // Check recent pair history (Section 56: exclude users who had a session together)
      const recentSession = await db.queryOne(
        `SELECT id FROM sessions 
         WHERE ((user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1))
           AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'`,
        [userId, candidateId]
      );
      if (recentSession) continue;

      // Compatible match found! Atomically create session and update queue entries
      const createdSessions = await db.query<SessionRecord>(
        `INSERT INTO sessions (user_a, user_b, status, started_at)
         VALUES ($1, $2, 'MATCHED', CURRENT_TIMESTAMP)
         RETURNING *`,
        [userId, candidateId]
      );
      const newSession = createdSessions[0];

      await db.query(
        `UPDATE queue_entries 
         SET status = 'MATCHED', session_id = $1, last_ping_at = CURRENT_TIMESTAMP
         WHERE user_id IN ($2, $3)`,
        [newSession.id, userId, candidateId]
      );

      return {
        status: 'MATCHED',
        sessionId: newSession.id,
        partner: {
          firstName: candidate.first_name,
          avatarType: candidate.avatar_type,
        },
      };
    }

    return { status: 'WAITING' };
  } finally {
    releaseLock();
  }
}

export async function leaveQueue(userId: string): Promise<void> {
  await db.query(
    `UPDATE queue_entries 
     SET status = 'CANCELLED', last_ping_at = CURRENT_TIMESTAMP
     WHERE user_id = $1`,
    [userId]
  );
}

export async function getQueueStatus(userId: string): Promise<{
  status: 'NOT_WAITING' | 'WAITING' | 'MATCHED';
  sessionId?: string;
  partner?: { firstName: string; avatarType: string };
}> {
  const entry = await db.queryOne<QueueEntryRecord>(
    `SELECT * FROM queue_entries WHERE user_id = $1`,
    [userId]
  );

  if (!entry || entry.status === 'CANCELLED') {
    return { status: 'NOT_WAITING' };
  }

  if (entry.status === 'MATCHED' && entry.session_id) {
    const session = await db.queryOne<SessionRecord>(
      `SELECT * FROM sessions WHERE id = $1`,
      [entry.session_id]
    );

    if (session) {
      const partnerId = session.user_a === userId ? session.user_b : session.user_a;
      const partnerProfile = await db.queryOne<ProfileRecord>(
        `SELECT first_name, avatar_type FROM profiles WHERE user_id = $1`,
        [partnerId]
      );

      return {
        status: 'MATCHED',
        sessionId: session.id,
        partner: partnerProfile
          ? {
              firstName: partnerProfile.first_name,
              avatarType: partnerProfile.avatar_type,
            }
          : undefined,
      };
    }
  }

  // Update keep-alive ping
  await db.query(
    `UPDATE queue_entries SET last_ping_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
    [userId]
  );

  return { status: 'WAITING' };
}

export async function getSessionForUser(sessionId: string, userId: string): Promise<{
  session: SessionRecord;
  partner: { firstName: string; avatarType: string; gender: string; bio: string | null; interests: string[] | null };
} | null> {
  const session = await db.queryOne<SessionRecord>(
    `SELECT * FROM sessions WHERE id = $1`,
    [sessionId]
  );

  if (!session) return null;

  // Verify caller belongs to this session (PRD Section 22 Server Authorization)
  if (session.user_a !== userId && session.user_b !== userId) {
    return null;
  }

  const partnerId = session.user_a === userId ? session.user_b : session.user_a;
  const partnerProfile = await db.queryOne<ProfileRecord>(
    `SELECT first_name, avatar_type, gender, bio, interests FROM profiles WHERE user_id = $1`,
    [partnerId]
  );

  if (!partnerProfile) return null;

  return {
    session,
    partner: {
      firstName: partnerProfile.first_name,
      avatarType: partnerProfile.avatar_type,
      gender: partnerProfile.gender,
      bio: partnerProfile.bio,
      interests: partnerProfile.interests,
    },
  };
}
