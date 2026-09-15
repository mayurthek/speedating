import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getQueueStatus } from '@/lib/matchmaking';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getQueueStatus(user.id);
    return NextResponse.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get queue status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
