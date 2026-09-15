import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAge, checkProfileCompletion, ProfileSchema } from '../src/lib/profile-validation.ts';
import { db } from '../src/lib/db.ts';
import fs from 'node:fs';
import path from 'node:path';

test('calculateAge correctly computes age and respects leap/birth month boundaries', () => {
  const today = new Date();
  const birthYear18 = today.getFullYear() - 18;
  const birthYear17 = today.getFullYear() - 17;

  const exactly18 = new Date(birthYear18, today.getMonth(), today.getDate()).toISOString().split('T')[0];
  assert.equal(calculateAge(exactly18), 18);

  const underage = new Date(birthYear17, today.getMonth(), today.getDate()).toISOString().split('T')[0];
  assert.equal(calculateAge(underage), 17);
});

test('ProfileSchema enforces 18+ requirement and rejects underage users', () => {
  const today = new Date();
  const underageDob = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate()).toISOString().split('T')[0];
  const validDob = new Date(today.getFullYear() - 22, today.getMonth(), today.getDate()).toISOString().split('T')[0];

  // Underage rejection
  const underageResult = ProfileSchema.safeParse({
    firstName: 'Alex',
    dateOfBirth: underageDob,
    gender: 'Man',
    avatarType: 'Man',
    interestedIn: 'Everyone',
    bio: 'Hello world',
    interests: ['Coffee', 'Books'],
  });
  assert.equal(underageResult.success, false);
  if (!underageResult.success) {
    const errorMsg = underageResult.error.issues[0].message;
    assert.match(errorMsg, /at least 18 years old/);
  }

  // Valid adult acceptance
  const validResult = ProfileSchema.safeParse({
    firstName: 'Alex',
    dateOfBirth: validDob,
    gender: 'Man',
    avatarType: 'Man',
    interestedIn: 'Women',
    bio: 'Enjoying life',
    interests: ['Coffee', 'Books', 'Music'],
  });
  assert.equal(validResult.success, true);
});

test('ProfileSchema limits interests to max 5 and bio to 160 characters', () => {
  const today = new Date();
  const validDob = new Date(today.getFullYear() - 20, 0, 1).toISOString().split('T')[0];

  // Too many interests
  const tooManyInterests = ProfileSchema.safeParse({
    firstName: 'Sam',
    dateOfBirth: validDob,
    gender: 'Woman',
    avatarType: 'Woman',
    interestedIn: 'Men',
    bio: 'Short bio',
    interests: ['A', 'B', 'C', 'D', 'E', 'F'], // 6 items
  });
  assert.equal(tooManyInterests.success, false);

  // Bio over 160 chars
  const bioTooLong = ProfileSchema.safeParse({
    firstName: 'Sam',
    dateOfBirth: validDob,
    gender: 'Woman',
    avatarType: 'Woman',
    interestedIn: 'Men',
    bio: 'A'.repeat(161),
    interests: ['Coffee'],
  });
  assert.equal(bioTooLong.success, false);
});

test('checkProfileCompletion accurately detects complete vs incomplete profiles', () => {
  const today = new Date();
  const adultDob = new Date(today.getFullYear() - 25, 0, 1).toISOString().split('T')[0];

  // Incomplete: missing first name and preference
  const incomplete = checkProfileCompletion({
    firstName: '',
    dateOfBirth: adultDob,
    gender: 'Man',
    avatarType: 'Man',
    interestedIn: null,
  });
  assert.equal(incomplete.isComplete, false);
  assert.ok(incomplete.missingFields.includes('First name'));
  assert.ok(incomplete.missingFields.includes('Dating preference'));

  // Complete with Man / Woman
  const complete = checkProfileCompletion({
    firstName: 'Taylor',
    dateOfBirth: adultDob,
    gender: 'Woman',
    avatarType: 'Woman',
    interestedIn: 'Everyone',
  });
  assert.equal(complete.isComplete, true);
  assert.equal(complete.missingFields.length, 0);

  // Complete with Other gender (avatar option disappears and is not required)
  const completeOther = checkProfileCompletion({
    firstName: 'Jordan',
    dateOfBirth: adultDob,
    gender: 'Other',
    avatarType: null,
    interestedIn: 'Everyone',
  });
  assert.equal(completeOther.isComplete, true);
  assert.equal(completeOther.missingFields.length, 0);
});

test('Database migration and live query operations execute successfully', async () => {
  const migrationFile = path.join(process.cwd(), 'migrations', '001_phase1_initial.sql');
  assert.ok(fs.existsSync(migrationFile), 'Migration file must exist');

  // Trigger migration
  await db.getClient();

  // Test insert user
  const email = `test.${Date.now()}@example.com`;
  const insertedUser = await db.query(
    `INSERT INTO users (email, status) VALUES ($1, 'ACTIVE') RETURNING id, email, status`,
    [email]
  );
  assert.equal(insertedUser.length, 1);
  const userId = insertedUser[0].id;
  assert.equal(insertedUser[0].email, email);

  // Test insert profile
  const insertedProfile = await db.query(
    `INSERT INTO profiles (user_id, first_name, date_of_birth, gender, avatar_type, bio, interests)
     VALUES ($1, 'Jordan', '1998-05-15', 'Man', 'Man', 'Bio text', '["Cinema", "Coffee"]'::jsonb)
     RETURNING *`,
    [userId]
  );
  assert.equal(insertedProfile.length, 1);
  assert.equal(insertedProfile[0].first_name, 'Jordan');

  // Test insert preferences
  const insertedPref = await db.query(
    `INSERT INTO preferences (user_id, interested_in) VALUES ($1, 'Everyone') RETURNING *`,
    [userId]
  );
  assert.equal(insertedPref.length, 1);
  assert.equal(insertedPref[0].interested_in, 'Everyone');

  // Verify retrieval
  const retrieved = await db.queryOne(
    `SELECT u.email, p.first_name, pr.interested_in 
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     JOIN preferences pr ON pr.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  assert.ok(retrieved);
  assert.equal(retrieved.first_name, 'Jordan');
  assert.equal(retrieved.interested_in, 'Everyone');
});
