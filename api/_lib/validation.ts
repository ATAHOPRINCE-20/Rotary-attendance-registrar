import { z } from 'zod';

export const validatePhoneNumber = (phone: string): boolean => {
  if (!phone) return true;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
};

export const registrationFormSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters'),

  email: z
    .string()
    .email('Please enter a valid email address')
    .max(254, 'Email must be less than 254 characters')
    .toLowerCase(),

  phone: z
    .string()
    .min(9, 'Phone number must be at least 9 digits')
    .max(20, 'Phone number must be less than 20 characters')
    .refine(validatePhoneNumber, 'Please enter a valid phone number'),

  clubName: z.string().max(150).optional().or(z.literal('')),
  buddyGroup: z.string().max(100).optional().or(z.literal('')),
});

export const getFieldErrors = (error: z.ZodError): Record<string, string> => {
  const errors: Record<string, string> = {};
  error.issues.forEach((err: z.ZodIssue) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });
  return errors;
};
