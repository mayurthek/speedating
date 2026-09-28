import { db, SessionRecord } from './db';
import { getSessionForUser } from './matchmaking';

export const ROUND_SECONDS = 180;
export const DECISION_TIMEOUT_SECONDS = 20;

/**
 * Derived status handed to the client. The database only stores MATCHED /
 * CONNECTING / ACTIVE / ENDING / COMPLETED / CANCELLED, so "the clock ran out
 * and we are waiting on both people" is a view-level state rather than a
 * persisted one. That keeps the existing sessions.status CHECK constraint valid.
 */
export type SessionViewStatus =
  | 'MATCHED'
  | 'ACTIVE'
  | 'AWAITING_DECISION'
  | 'COMPLETED'
  | 'CANCELLED';

export interface SessionView {
  session: SessionRecord;
  partner: {
    firstName: string;
    avatarType: string;
    gender: string;
    bio: string | null;
    interests: string[] | null;
  };
  partnerId: string;
  status: SessionViewStatus;
  endsAt: string | null;
  question: { id: string; text: string } | null;
  youDecided: boolean;
  partnerDecided: boolean;
  round: number;
}

/** Accepts Date, ISO string or epoch millis. */
function toMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function toIso(value: unknown): string | null {
  const ms = toMs(value);
  return ms === null ? null : new Date(ms).toISOString();
}

/**
 * Lazily flip a freshly matched session into its first round.
 *
 * The room screen has no start button, so the first GET that arrives after the
 * match starts the clock. The `status = 'MATCHED'` predicate makes this
 * idempotent and safe against two people arriving at the same moment.
 */
async function activateIfMatched(sessionId: string): Promise<void> {
  const endsAt = new Date(Date.now() + ROUND_SECONDS * 1000);

  const activated = await db.queryOne<SessionRecord>(
    `UPDATE sessions
        SET status = 'ACTIVE',
            started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
            ends_at = $2,
            decision_deadline = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'MATCHED'
      RETURNING id, round`,
    [sessionId, endsAt.toISOString()]
  );

  if (activated) {
    await assignQuestion(sessionId, activated.round);
  }
}

/**
 * Pick a question this session has not shown yet. If the pool is exhausted the
 * pair loops back to any question rather than showing nothing.
 */
async function assignQuestion(sessionId: string, round: number): Promise<void> {
  const row = await db.queryOne<{ id: string }>(
    `SELECT q.id
       FROM questions q
      WHERE q.id NOT IN (
            SELECT question_id FROM session_questions WHERE session_id = $1
          )
      ORDER BY random()
      LIMIT 1`,
    [sessionId]
  );

  const questionId =
    row?.id ??
    (
      await db.queryOne<{ id: string }>('SELECT id FROM questions ORDER BY random() LIMIT 1')
    )?.id;

  if (!questionId) return;

  await db.query(
    `INSERT INTO session_questions (session_id, round, question_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, round) DO NOTHING`,
    [sessionId, round, questionId]
  );

  // Denormalised pointer to the question currently on screen.
  await db.query('UPDATE sessions SET question_id = $2 WHERE id = $1', [sessionId, questionId]);
}

async function getCurrentQuestion(
  sessionId: string,
  round: number
): Promise<{ id: string; text: string } | null> {
  return db.queryOne<{ id: string; text: string }>(
    `SELECT q.id, q.text
       FROM session_questions sq
       JOIN questions q ON q.id = sq.question_id
      WHERE sq.session_id = $1 AND sq.round = $2`,
    [sessionId, round]
  );
}

async function getDecision(
  sessionId: string,
  userId: string,
  round: number
): Promise<'KEEP' | 'MOVE_ON' | null> {
  const row = await db.queryOne<{ decision: 'KEEP' | 'MOVE_ON' }>(
    'SELECT decision FROM session_decisions WHERE session_id = $1 AND user_id = $2 AND round = $3',
    [sessionId, userId, round]
  );
  return row?.decision ?? null;
}

/**
 * Advance the session to whatever it should be given the clock and the votes
 * cast so far. Idempotent, and safe to call from any request.
 */
async function settle(session: SessionRecord): Promise<SessionRecord> {
  if (session.status !== 'ACTIVE') return session;

  const round = session.round;
  const now = Date.now();
  const endsAtMs = toMs(session.ends_at);
  const roundOver = endsAtMs !== null && now >= endsAtMs;

  // Clock has not run out: nothing to reconcile yet.
  if (!roundOver) return session;

  const [aDecision, bDecision] = await Promise.all([
    getDecision(session.id, session.user_a, round),
    getDecision(session.id, session.user_b, round),
  ]);

  const everyoneVoted = aDecision !== null && bDecision !== null;
  const timedOut = !everyoneVoted && toMs(session.decision_deadline) !== null && now >= toMs(session.decision_deadline)!;

  // Record the deadline on first entry so later reads know when to force a verdict.
  if (!everyoneVoted && !timedOut && session.decision_deadline === null) {
    const deadline = new Date(endsAtMs! + DECISION_TIMEOUT_SECONDS * 1000).toISOString();
    await db.query(
      `UPDATE sessions SET decision_deadline = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [session.id, deadline]
    );
    return { ...session, decision_deadline: deadline };
  }

  // Someone walked away without voting. Treat silence as MOVE_ON rather than
  // letting the remaining person sit in an empty room.
  if (timedOut && !everyoneVoted) {
    const moves: Array<[string, 'MOVE_ON']> = [];
    if (aDecision === null) moves.push([session.user_a, 'MOVE_ON']);
    if (bDecision === null) moves.push([session.user_b, 'MOVE_ON']);
    for (const [userId, decision] of moves) {
      await db.query(
        `INSERT INTO session_decisions (session_id, user_id, round, decision)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id, user_id, round) DO NOTHING`,
        [session.id, userId, round, decision]
      );
    }
    return completeSession(session);
  }

  if (!everyoneVoted) return session;

  // Both said KEEP: start the next round with a fresh question.
  if (aDecision === 'KEEP' && bDecision === 'KEEP') {
    const nextRound = round + 1;
    const nextEndsAt = new Date(Date.now() + ROUND_SECONDS * 1000).toISOString();

    const extended = await db.queryOne<SessionRecord>(
      `UPDATE sessions
          SET round = $2,
              ends_at = $3,
              decision_deadline = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'ACTIVE' AND round = $4
        RETURNING *`,
      [session.id, nextRound, nextEndsAt, round]
    );

    if (extended) {
      await assignQuestion(session.id, nextRound);
      return extended;
    }
    return session;
  }

  // Either person moving on ends the date.
  return completeSession(session);
}

async function completeSession(session: SessionRecord): Promise<SessionRecord> {
  const completed = await db.queryOne<SessionRecord>(
    `UPDATE sessions
        SET status = 'COMPLETED',
            decision_deadline = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'ACTIVE'
      RETURNING *`,
    [session.id]
  );

  if (completed) {
    // Release both queue entries so the pair can queue again immediately.
    await db.query(
      `UPDATE queue_entries
          SET status = 'CANCELLED', last_ping_at = CURRENT_TIMESTAMP
        WHERE user_id IN ($1, $2)`,
      [session.user_a, session.user_b]
    );
  }

  return completed ?? session;
}

export class SessionAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionAccessError';
  }
}

/**
 * Full client-facing state for one session. Returns null when the caller is not
 * a participant; callers translate that into a 404 so an unrelated user cannot
 * probe for session ids.
 */
export async function getSessionView(
  sessionId: string,
  userId: string
): Promise<SessionView | null> {
  const access = await getSessionForUser(sessionId, userId);
  if (!access) return null;

  await activateIfMatched(sessionId);

  let session = access.session;
  const refreshed = await db.queryOne<SessionRecord>('SELECT * FROM sessions WHERE id = $1', [
    sessionId,
  ]);
  if (refreshed) session = refreshed;

  session = await settle(session);

  const round = session.round;
  const partnerId = session.user_a === userId ? session.user_b : session.user_a;

  const [question, youDecided, partnerDecided] = await Promise.all([
    getCurrentQuestion(sessionId, round),
    getDecision(sessionId, userId, round).then((d) => d !== null),
    getDecision(sessionId, partnerId, round).then((d) => d !== null),
  ]);

  return {
    session,
    partner: access.partner,
    partnerId,
    status: deriveStatus(session),
    endsAt: toIso(session.ends_at),
    question,
    youDecided,
    partnerDecided,
    round,
  };
}

function deriveStatus(session: SessionRecord): SessionViewStatus {
  if (session.status === 'COMPLETED') return 'COMPLETED';
  if (session.status === 'CANCELLED') return 'CANCELLED';
  if (session.status !== 'ACTIVE') return 'MATCHED';

  const endsAtMs = toMs(session.ends_at);
  if (endsAtMs !== null && Date.now() >= endsAtMs) return 'AWAITING_DECISION';
  return 'ACTIVE';
}

export type Decision = 'KEEP' | 'MOVE_ON';

/**
 * Record a vote for the current round and apply the outcome. Returns the same
 * shape as getSessionView so the caller can render the result without a second
 * round trip.
 */
export async function submitDecision(
  sessionId: string,
  userId: string,
  decision: Decision
): Promise<SessionView> {
  const access = await getSessionForUser(sessionId, userId);
  if (!access) {
    throw new SessionAccessError('Session not found or unauthorized');
  }

  await activateIfMatched(sessionId);

  let session = await db.queryOne<SessionRecord>('SELECT * FROM sessions WHERE id = $1', [
    sessionId,
  ]);
  if (!session) {
    throw new SessionAccessError('Session not found or unauthorized');
  }

  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    throw new SessionAccessError('This date has already finished');
  }

  // Voting early ends the round immediately, exactly as if the clock had run out.
  const roundOver = toMs(session.ends_at) !== null && Date.now() >= toMs(session.ends_at)!;

  if (!roundOver) {
    await db.query(
      `UPDATE sessions SET ends_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [sessionId]
    );
  }

  await db.query(
    `INSERT INTO session_decisions (session_id, user_id, round, decision)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (session_id, user_id, round)
     DO UPDATE SET decision = EXCLUDED.decision, created_at = CURRENT_TIMESTAMP`,
    [sessionId, userId, session.round, decision]
  );

  session = (await db.queryOne<SessionRecord>('SELECT * FROM sessions WHERE id = $1', [sessionId]))!;
  session = await settle(session);

  const refreshed = await db.queryOne<SessionRecord>('SELECT * FROM sessions WHERE id = $1', [
    sessionId,
  ]);
  if (refreshed) session = refreshed;

  const partnerId = session.user_a === userId ? session.user_b : session.user_a;
  const [question, youDecided, partnerDecided] = await Promise.all([
    getCurrentQuestion(sessionId, session.round),
    getDecision(sessionId, userId, session.round).then((d) => d !== null),
    getDecision(sessionId, partnerId, session.round).then((d) => d !== null),
  ]);

  return {
    session,
    partner: access.partner,
    partnerId,
    status: deriveStatus(session),
    endsAt: toIso(session.ends_at),
    question,
    youDecided,
    partnerDecided,
    round: session.round,
  };
}
