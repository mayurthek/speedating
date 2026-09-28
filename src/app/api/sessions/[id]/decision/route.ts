import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { SessionAccessError, submitDecision } from '@/lib/session-loop';

export const dynamic = 'force-dynamic';

const DecisionBody = z.object({
  decision: z.enum(['KEEP', 'MOVE_ON'], {
    error: 'decision must be KEEP or MOVE_ON',
  }),
});

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = DecisionBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'decision must be KEEP or MOVE_ON' }, { status: 400 });
    }

    const { id } = await props.params;

    let view;
    try {
      view = await submitDecision(id, user.id, parsed.data.decision);
    } catch (error: unknown) {
      if (error instanceof SessionAccessError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(view);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record decision';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
