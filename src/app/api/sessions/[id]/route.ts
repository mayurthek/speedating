import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getSessionForUser } from '@/lib/matchmaking';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;
    const sessionDetails = await getSessionForUser(id, user.id);

    if (!sessionDetails) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json(sessionDetails);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
