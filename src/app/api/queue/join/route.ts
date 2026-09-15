import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { joinQueue } from '@/lib/matchmaking';

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await joinQueue(user.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to join queue';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
