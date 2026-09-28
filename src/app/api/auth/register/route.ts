import { NextResponse } from 'next/server';
import { createSession, getAuthPayload, registerUser } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { RegistrationSchema } from '@/lib/auth-validation';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = RegistrationSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path.join('.') || 'password';
      return NextResponse.json(
        { error: `${field}: ${issue?.message ?? 'Invalid details'}` },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Hash before touching the database so the uniqueness check is not the
    // slowest part of the request.
    const passwordHash = await hashPassword(password);
    const user = await registerUser(email, passwordHash);

    if (!user) {
      return NextResponse.json(
        { error: 'An account with that email already exists. Try logging in.' },
        { status: 409 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({ success: true, ...(await getAuthPayload(user)) }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
