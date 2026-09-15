import { NextResponse } from 'next/server';
import { getOrCreateUser, createSession } from '@/lib/auth';
import { db, ProfileRecord, PreferenceRecord } from '@/lib/db';
import { checkProfileCompletion } from '@/lib/profile-validation';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const user = await getOrCreateUser(email);

    if (user.status === 'BANNED') {
      return NextResponse.json({ error: 'This account has been suspended or banned' }, { status: 403 });
    }

    await createSession(user.id);

    // Retrieve profile & preferences
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
      success: true,
      user: { id: user.id, email: user.email, status: user.status },
      profile,
      preference,
      profileComplete: completion.isComplete,
      missingFields: completion.missingFields,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
