import { NextResponse } from 'next/server';
import { getSessionUser, getPendingIntent } from '@/lib/auth';
import { db, ProfileRecord, PreferenceRecord } from '@/lib/db';
import { checkProfileCompletion } from '@/lib/profile-validation';

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    const profile = await db.queryOne<ProfileRecord>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [user.id]
    );

    const preference = await db.queryOne<PreferenceRecord>(
      'SELECT * FROM preferences WHERE user_id = $1',
      [user.id]
    );

    const pendingIntent = await getPendingIntent();

    const completion = checkProfileCompletion({
      firstName: profile?.first_name,
      dateOfBirth: profile?.date_of_birth,
      gender: profile?.gender,
      avatarType: profile?.avatar_type,
      interestedIn: preference?.interested_in,
    });

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
      profile,
      preference,
      pendingIntent,
      profileComplete: completion.isComplete,
      missingFields: completion.missingFields,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Session verification failed';
    return NextResponse.json({ authenticated: false, error: message }, { status: 500 });
  }
}
