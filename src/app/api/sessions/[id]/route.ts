import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getSessionView } from '@/lib/session-loop';

// Session state changes constantly (countdown, votes), so never cache it.
export const dynamic = 'force-dynamic';

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
    const view = await getSessionView(id, user.id);

    if (!view) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json(view);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
