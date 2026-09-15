import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/lib/db.ts';
import { areCompatible, joinQueue, leaveQueue, getQueueStatus, getSessionForUser } from '../src/lib/matchmaking.ts';

// Helper to seed a complete user, profile, and preference
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

  await db.query(
    `INSERT INTO preferences (user_id, interested_in) VALUES ($1, $2)`,
    [userId, interestedIn]
  );

  return userId;
}

async function cleanDatabase() {
  await db.getClient();
  await db.query('DELETE FROM queue_entries');
  await db.query('DELETE FROM sessions');
  await db.query('DELETE FROM blocks');
}

test('areCompatible correctly checks mutual preference alignment', () => {
  // Man seeking Women + Woman seeking Men = Compatible
  assert.equal(
    areCompatible(
      { gender: 'Man', interestedIn: 'Women' },
      { gender: 'Woman', interestedIn: 'Men' }
    ),
    true
  );

  // Man seeking Women + Man seeking Women = Incompatible
  assert.equal(
    areCompatible(
      { gender: 'Man', interestedIn: 'Women' },
      { gender: 'Man', interestedIn: 'Women' }
    ),
    false
  );

  // Man seeking Women + Woman seeking Women = Incompatible (one-sided mismatch)
  assert.equal(
    areCompatible(
      { gender: 'Man', interestedIn: 'Women' },
      { gender: 'Woman', interestedIn: 'Women' }
    ),
    false
  );

  // Everyone matches valid counterparts
  assert.equal(
    areCompatible(
      { gender: 'Other', interestedIn: 'Everyone' },
      { gender: 'Woman', interestedIn: 'Everyone' }
    ),
    true
  );
});

test('Two compatible users join queue and successfully match into the same session', async () => {
  await cleanDatabase();

  const userA = await createTestUser(`userA.${Date.now()}@example.com`, 'Man', 'Women', 'Alex');
  const userB = await createTestUser(`userB.${Date.now()}@example.com`, 'Woman', 'Men', 'Sarah');

  // User A joins -> WAITING
  const resA = await joinQueue(userA);
  assert.equal(resA.status, 'WAITING');

  const statusA1 = await getQueueStatus(userA);
  assert.equal(statusA1.status, 'WAITING');

  // User B joins -> MATCHED with User A
  const resB = await joinQueue(userB);
  assert.equal(resB.status, 'MATCHED');
  assert.ok(resB.sessionId);

  // User A should now also be MATCHED to the same session
  const statusA2 = await getQueueStatus(userA);
  assert.equal(statusA2.status, 'MATCHED');
  assert.equal(statusA2.sessionId, resB.sessionId);

  // Verify session details
  const sessionDetailsA = await getSessionForUser(resB.sessionId, userA);
  assert.ok(sessionDetailsA);
  assert.equal(sessionDetailsA.partner.firstName, 'Sarah');

  const sessionDetailsB = await getSessionForUser(resB.sessionId, userB);
  assert.ok(sessionDetailsB);
  assert.equal(sessionDetailsB.partner.firstName, 'Alex');
});

test('Incompatible users do not match and remain waiting', async () => {
  await cleanDatabase();

  const userM1 = await createTestUser(`m1.${Date.now()}@example.com`, 'Man', 'Women', 'Mike');
  const userM2 = await createTestUser(`m2.${Date.now()}@example.com`, 'Man', 'Women', 'Mark');

  await joinQueue(userM1);
  const resM2 = await joinQueue(userM2);

  assert.equal(resM2.status, 'WAITING');

  const status1 = await getQueueStatus(userM1);
  const status2 = await getQueueStatus(userM2);
  assert.equal(status1.status, 'WAITING');
  assert.equal(status2.status, 'WAITING');
});

test('Blocks prevent matching between users', async () => {
  await cleanDatabase();

  const userA = await createTestUser(`blockA.${Date.now()}@example.com`, 'Man', 'Women', 'Bob');
  const userB = await createTestUser(`blockB.${Date.now()}@example.com`, 'Woman', 'Men', 'Alice');

  // User A blocks User B
  await db.query(`INSERT INTO blocks (user_id, blocked_user_id) VALUES ($1, $2)`, [userA, userB]);

  await joinQueue(userA);
  const resB = await joinQueue(userB);

  // Should NOT match because A blocked B
  assert.equal(resB.status, 'WAITING');
  const statusA = await getQueueStatus(userA);
  assert.equal(statusA.status, 'WAITING');
});

test('Recent session history prevents immediate rematching', async () => {
  await cleanDatabase();

  const userA = await createTestUser(`prevA.${Date.now()}@example.com`, 'Man', 'Women', 'Dave');
  const userB = await createTestUser(`prevB.${Date.now()}@example.com`, 'Woman', 'Men', 'Emma');

  // Create previous session between them
  await db.query(`INSERT INTO sessions (user_a, user_b, status) VALUES ($1, $2, 'COMPLETED')`, [userA, userB]);

  await joinQueue(userA);
  const resB = await joinQueue(userB);

  // Should not match due to recent pair history
  assert.equal(resB.status, 'WAITING');
});

test('Simultaneous match requests: 3 compatible users results in exactly 1 pair and 1 waiting user', async () => {
  await cleanDatabase();

  const userW1 = await createTestUser(`simW1.${Date.now()}@example.com`, 'Woman', 'Men', 'Clara');
  const userM1 = await createTestUser(`simM1.${Date.now()}@example.com`, 'Man', 'Women', 'Dan');
  const userM2 = await createTestUser(`simM2.${Date.now()}@example.com`, 'Man', 'Women', 'Eric');

  // All 3 queue up concurrently
  await Promise.all([
    joinQueue(userW1),
    joinQueue(userM1),
    joinQueue(userM2),
  ]);

  const finalStatus1 = await getQueueStatus(userW1);
  const finalStatus2 = await getQueueStatus(userM1);
  const finalStatus3 = await getQueueStatus(userM2);

  const finalMatched = [finalStatus1, finalStatus2, finalStatus3].filter((s) => s.status === 'MATCHED');
  const finalWaiting = [finalStatus1, finalStatus2, finalStatus3].filter((s) => s.status === 'WAITING');

  assert.equal(finalMatched.length, 2, 'Exactly two users must be in a matched pair');
  assert.equal(finalWaiting.length, 1, 'Exactly one user must remain waiting');
  assert.equal(finalMatched[0].sessionId, finalMatched[1].sessionId, 'Both matched users must share the same session ID');
});

test('User leaving queue is marked cancelled and excluded from matchmaking', async () => {
  await cleanDatabase();

  const user = await createTestUser(`leave.${Date.now()}@example.com`, 'Man', 'Women', 'Lucas');

  await joinQueue(user);
  let status = await getQueueStatus(user);
  assert.equal(status.status, 'WAITING');

  await leaveQueue(user);
  status = await getQueueStatus(user);
  assert.equal(status.status, 'NOT_WAITING');
});
