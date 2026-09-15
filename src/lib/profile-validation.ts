import { z } from 'zod';

export function calculateAge(birthDate: string | Date): number {
  const today = new Date();
  const dob = new Date(birthDate);
  if (isNaN(dob.getTime())) return 0;

  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export const ProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: 'First name is required' })
    .max(64, { message: 'First name cannot exceed 64 characters' }),
  dateOfBirth: z
    .string()
    .refine((val) => {
      const age = calculateAge(val);
      return age >= 18;
    }, { message: 'You must be at least 18 years old to use Speedating' })
    .refine((val) => {
      const age = calculateAge(val);
      return age <= 120;
    }, { message: 'Please enter a valid date of birth' }),
  gender: z.enum(['Man', 'Woman', 'Other'], {
    error: 'Please select a gender presentation',
  }),
  avatarType: z.enum(['Man', 'Woman', 'Other']).optional(),
  interestedIn: z.enum(['Men', 'Women', 'Everyone'], {
    error: 'Please select who you are interested in meeting',
  }),
  bio: z
    .string()
    .trim()
    .max(160, { message: 'Bio cannot exceed 160 characters' })
    .optional()
    .default(''),
  interests: z
    .array(z.string().trim().min(1).max(32))
    .max(5, { message: 'You may select up to 5 interests' })
    .optional()
    .default([]),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;

export interface ProfileCompletionStatus {
  isComplete: boolean;
  missingFields: string[];
}

export function checkProfileCompletion(data: {
  firstName?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  avatarType?: string | null;
  interestedIn?: string | null;
}): ProfileCompletionStatus {
  const missingFields: string[] = [];

  if (!data.firstName || data.firstName.trim().length === 0) {
    missingFields.push('First name');
  }
  if (!data.dateOfBirth || calculateAge(data.dateOfBirth) < 18) {
    missingFields.push('Date of birth (18+)');
  }
  if (!data.gender) {
    missingFields.push('Gender');
  }
  // Avatar is automatically assigned from gender; only missing if neither avatarType nor gender is provided
  if (!data.avatarType && !data.gender) {
    missingFields.push('Avatar');
  }
  if (!data.interestedIn) {
    missingFields.push('Dating preference');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}
