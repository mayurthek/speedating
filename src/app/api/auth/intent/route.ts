import { NextResponse } from 'next/server';
import { setPendingIntent } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const intent = body.intent || 'video';
    await setPendingIntent(intent);
    return NextResponse.json({ success: true, intent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to set intent';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
