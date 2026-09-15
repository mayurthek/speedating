import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { leaveQueue } from '@/lib/matchmaking';

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await leaveQueue(user.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to leave queue';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
