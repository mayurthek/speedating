import { NextResponse } from 'next/server';
import { authenticateUser, createSession, getAuthPayload } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { LoginSchema } from '@/lib/auth-validation';

// Deliberately identical message for unknown email and wrong password so the
// endpoint cannot be used to discover which addresses are registered.
const GENERIC_FAILURE = 'Incorrect email or password';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
    }

    const { email, password } = parsed.data;
    const user = await authenticateUser(email, password, verifyPassword);

    if (!user) {
      return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
    }

    await createSession(user.id);

    return NextResponse.json({ success: true, ...(await getAuthPayload(user)) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
