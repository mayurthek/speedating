import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, ProfileRecord, PreferenceRecord } from '@/lib/db';
import { ProfileSchema, checkProfileCompletion } from '@/lib/profile-validation';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await db.queryOne<ProfileRecord>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [user.id]
    );

    const preference = await db.queryOne<PreferenceRecord>(
      'SELECT * FROM preferences WHERE user_id = $1',
      [user.id]
    );

    const completion = checkProfileCompletion({
      firstName: profile?.first_name,
      dateOfBirth: profile?.date_of_birth,
      gender: profile?.gender,
      avatarType: profile?.avatar_type,
      interestedIn: preference?.interested_in,
    });

    return NextResponse.json({
      profile,
      preference,
      profileComplete: completion.isComplete,
      missingFields: completion.missingFields,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Strict Zod validation
    const parsed = ProfileSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid profile data' },
        { status: 400 }
      );
    }

    const { firstName, dateOfBirth, gender, avatarType, interestedIn, bio, interests } = parsed.data;
    const effectiveAvatarType = avatarType || (gender === 'Woman' ? 'Woman' : gender === 'Other' ? 'Other' : 'Man');

    // Upsert Profile
    const existingProfile = await db.queryOne<ProfileRecord>(
      'SELECT id FROM profiles WHERE user_id = $1',
      [user.id]
    );

    let profile: ProfileRecord;
    if (existingProfile) {
      const updated = await db.query<ProfileRecord>(
        `UPDATE profiles 
         SET first_name = $1, date_of_birth = $2, gender = $3, avatar_type = $4, bio = $5, interests = $6::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $7
         RETURNING *`,
        [firstName, dateOfBirth, gender, effectiveAvatarType, bio || null, JSON.stringify(interests || []), user.id]
      );
      profile = updated[0];
    } else {
      const inserted = await db.query<ProfileRecord>(
        `INSERT INTO profiles (user_id, first_name, date_of_birth, gender, avatar_type, bio, interests)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING *`,
        [user.id, firstName, dateOfBirth, gender, effectiveAvatarType, bio || null, JSON.stringify(interests || [])]
      );
      profile = inserted[0];
    }

    // Upsert Preferences
    const existingPref = await db.queryOne<PreferenceRecord>(
      'SELECT id FROM preferences WHERE user_id = $1',
      [user.id]
    );

    let preference: PreferenceRecord;
    if (existingPref) {
      const updated = await db.query<PreferenceRecord>(
        `UPDATE preferences 
         SET interested_in = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2
         RETURNING *`,
        [interestedIn, user.id]
      );
      preference = updated[0];
    } else {
      const inserted = await db.query<PreferenceRecord>(
        `INSERT INTO preferences (user_id, interested_in)
         VALUES ($1, $2)
         RETURNING *`,
        [user.id, interestedIn]
      );
      preference = inserted[0];
    }

    const completion = checkProfileCompletion({
      firstName: profile.first_name,
      dateOfBirth: profile.date_of_birth,
      gender: profile.gender,
      avatarType: profile.avatar_type,
      interestedIn: preference.interested_in,
    });

    return NextResponse.json({
      success: true,
      profile,
      preference,
      profileComplete: completion.isComplete,
      missingFields: completion.missingFields,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
