import { z } from 'zod';

// Client-safe credential rules. Kept separate from `password.ts` because that
// module imports node:crypto and cannot be pulled into a client bundle.

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

export const EmailSchema = z
  .string()
  .trim()
  .min(1, { message: 'Email is required' })
  .max(254, { message: 'Email is too long' })
  .email({ message: 'Enter a valid email address' });

export const PasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  })
  .max(MAX_PASSWORD_LENGTH, { message: 'Password is too long' })
  .refine((val) => val.trim().length > 0, {
    message: 'Password cannot be only spaces',
  });

export const RegistrationSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export const LoginSchema = z.object({
  email: EmailSchema,
  // Login only checks presence; strength rules belong at registration time.
  password: z.string().min(1, { message: 'Password is required' }),
});

export type RegistrationInput = z.infer<typeof RegistrationSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

/** Describe a password's weaknesses without echoing the password back. */
export function describePasswordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    issues.push(`at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!/[a-zA-Z]/.test(password)) issues.push('a letter');
  if (!/[0-9]/.test(password)) issues.push('a number');
  return issues;
}
