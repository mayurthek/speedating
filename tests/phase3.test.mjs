import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/lib/db.ts';
import { joinQueue } from '../src/lib/matchmaking.ts';
import { getSessionView, submitDecision, SessionAccessError } from '../src/lib/session-loop.ts';

async function createTestUser(email, gender, interestedIn, firstName = 'User') {
  const userRows = await db.query(
    `INSERT INTO users (email, status) VALUES ($1, 'ACTIVE') RETURNING id`,
    [email]
  );
  const userId = userRows[0].id;

  await db.query(
    `INSERT INTO profiles (user_id, first_name, date_of_birth, gender, avatar_type, bio, interests)
     VALUES ($1, $2, '1996-01-01', $3, $4, 'Bio', '["Coffee"]'::jsonb)`,
    [userId, firstName, gender, gender === 'Other' ? 'Other' : gender]
  );

  await db.query(`INSERT INTO preferences (user_id, interested_in) VALUES ($1, $2)`, [
    userId,
    interestedIn,
  ]);

  return userId;
}

async function cleanDatabase() {
  await db.getClient();
  await db.query('DELETE FROM session_decisions');
  await db.query('DELETE FROM session_questions');
  await db.query('DELETE FROM queue_entries');
  await db.query('DELETE FROM sessions');
  await db.query('DELETE FROM blocks');
}

/** Two mutually compatible users, matched into a live session. */
async function createMatchedPair() {
  const a = await createTestUser(`loop-a-${Date.now()}@test.local`, 'Man', 'Women', 'Ada');
  const b = await createTestUser(`loop-b-${Date.now()}@test.local`, 'Woman', 'Men', 'Bo');

  await joinQueue(a);
  const joined = await joinQueue(b);
  assert.equal(joined.status, 'MATCHED', 'pair should match');

  return { a, b, sessionId: joined.sessionId };
}

/** Move the round deadline into the past so the clock reads as expired. */
async function expireClock(sessionId) {
  await db.query(
    `UPDATE sessions SET ends_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = $1`,
    [sessionId]
  );
}

test('question pool is seeded and free of duplicates', async () => {
  await db.getClient();
  const rows = await db.query('SELECT text FROM questions');
  assert.ok(rows.length >= 20, `expected a seeded question pool, got ${rows.length}`);

  const texts = rows.map((r) => r.text);
  assert.equal(new Set(texts).size, texts.length, 'question text should be unique');
});

test('first read activates the round with a deadline and a question', async () => {
  await cleanDatabase();
  const { a, sessionId } = await createMatchedPair();

  const view = await getSessionView(sessionId, a);

  assert.equal(view.status, 'ACTIVE');
  assert.ok(view.endsAt, 'endsAt should be returned so the client stops using its local clock');
  assert.ok(view.question?.text, 'a shared question should be assigned');
  assert.equal(view.youDecided, false);
  assert.equal(view.partnerDecided, false);
  assert.equal(view.round, 1);
});

test('the same round is never given two questions', async () => {
  await cleanDatabase();
  const { a, b, sessionId } = await createMatchedPair();

  await getSessionView(sessionId, a);
  const fromA = await getSessionView(sessionId, a);

  // The partner must see the identical question.
  const fromB = await getSessionView(sessionId, b);
  assert.equal(fromB.question.id, fromA.question.id, 'both people share one question');

  const rows = await db.query('SELECT round FROM session_questions WHERE session_id = $1', [
    sessionId,
  ]);
  assert.equal(rows.length, 1, 'only one question per round');
});

test('both choosing KEEP starts a new round with a fresh question', async () => {
  await cleanDatabase();
  const { a, b, sessionId } = await createMatchedPair();

  const first = await getSessionView(sessionId, a);
  await expireClock(sessionId);

  await submitDecision(sessionId, a, 'KEEP');
  const afterA = await getSessionView(sessionId, a);
  assert.equal(afterA.status, 'AWAITING_DECISION', 'waiting on the partner after one vote');
  assert.equal(afterA.youDecided, true);
  assert.equal(afterA.partnerDecided, false);
  assert.equal(afterA.round, 1, 'the round has not advanced yet');

  const result = await submitDecision(sessionId, b, 'KEEP');

  assert.equal(result.status, 'ACTIVE', 'a new round begins once both agree');
  assert.equal(result.round, 2);
  assert.ok(result.endsAt);
  assert.notEqual(result.question.id, first.question.id, 'the new round shows a different question');
  assert.equal(result.youDecided, false, 'votes reset for the new round');
});

test('either person moving on ends the date and frees both queue entries', async () => {
  await cleanDatabase();
  const { a, b, sessionId } = await createMatchedPair();

  await getSessionView(sessionId, a);
  await expireClock(sessionId);

  await submitDecision(sessionId, a, 'KEEP');
  const ended = await submitDecision(sessionId, b, 'MOVE_ON');

  assert.equal(ended.status, 'COMPLETED');

  const entries = await db.query('SELECT user_id, status FROM queue_entries');
  for (const entry of entries) {
    assert.equal(entry.status, 'CANCELLED', 'both are released back to the queue');
  }
});

test('a single MOVE_ON beats a KEEP', async () => {
  await cleanDatabase();
  const { a, b, sessionId } = await createMatchedPair();

  await getSessionView(sessionId, a);
  await expireClock(sessionId);

  await submitDecision(sessionId, a, 'MOVE_ON');
  const result = await submitDecision(sessionId, b, 'KEEP');

  assert.equal(result.status, 'COMPLETED', 'one person moving on ends it for both');
});

test('voting before the clock runs out ends the round early', async () => {
  await cleanDatabase();
  const { a, b, sessionId } = await createMatchedPair();

  await getSessionView(sessionId, a);

  // No clock manipulation: both vote while the timer still has time left.
  await submitDecision(sessionId, a, 'MOVE_ON');
  const result = await submitDecision(sessionId, b, 'KEEP');

  assert.equal(result.status, 'COMPLETED');
});

test('a decision is recorded per person, not shared', async () => {
  await cleanDatabase();
  const { a, b, sessionId } = await createMatchedPair();

  await getSessionView(sessionId, a);
  await expireClock(sessionId);

  await submitDecision(sessionId, a, 'KEEP');

  const asA = await getSessionView(sessionId, a);
  const asB = await getSessionView(sessionId, b);

  assert.equal(asA.youDecided, true);
  assert.equal(asA.partnerDecided, false);
  assert.equal(asB.youDecided, false);
  assert.equal(asB.partnerDecided, true, 'the partner sees the vote without having cast one');
});

test('an outsider cannot read or vote in a session', async () => {
  await cleanDatabase();
  const { a, sessionId } = await createMatchedPair();
  const stranger = await createTestUser(`stranger-${Date.now()}@test.local`, 'Woman', 'Men', 'Eve');

  assert.equal(await getSessionView(sessionId, stranger), null, 'state is hidden from non-participants');

  await assert.rejects(
    () => submitDecision(sessionId, stranger, 'KEEP'),
    SessionAccessError,
    'non-participants cannot cast a vote'
  );

  assert.ok(a, 'sanity: participant id still resolves');
});

test('a finished date rejects further votes', async () => {
  await cleanDatabase();
  const { a, b, sessionId } = await createMatchedPair();

  await getSessionView(sessionId, a);
  await expireClock(sessionId);
  await submitDecision(sessionId, a, 'MOVE_ON');
  await submitDecision(sessionId, b, 'MOVE_ON');

  await assert.rejects(
    () => submitDecision(sessionId, a, 'KEEP'),
    SessionAccessError,
    'no voting after the date has ended'
  );
});
