import { z } from 'zod';

// ===========================================
// HELPER: International & Ugandan Phone Validation
// ===========================================
export const validatePhoneNumber = (phone: string): boolean => {
  if (!phone) return true; // Optional phone check handled separately
  const digits = phone.replace(/\D/g, '');
  // Uganda (+256 or 07xx/03xx): 9 to 12 digits
  // General International: 8 to 15 digits
  return digits.length >= 8 && digits.length <= 15;
};

// ===========================================
// ATTENDEE / REGISTRATION FORM SCHEMA
// ===========================================
export const registrationFormSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-'\.\/]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),

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

  clubName: z
    .string()
    .max(150, 'Club name must be less than 150 characters')
    .optional()
    .or(z.literal('')),

  buddyGroup: z
    .string()
    .max(100, 'Buddy group must be less than 100 characters')
    .optional()
    .or(z.literal('')),
});

export type RegistrationFormData = z.infer<typeof registrationFormSchema>;

// ===========================================
// GENERAL CONTACT / ENQUIRY SCHEMA
// ===========================================
export const enquiryFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),

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

  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must be less than 2000 characters'),

  agreedToTerms: z
    .boolean()
    .refine(val => val === true, 'You must agree to the terms and privacy policy'),
});

export type EnquiryFormData = z.infer<typeof enquiryFormSchema>;

// ===========================================
// NEWSLETTER / EMAIL SUBSCRIBER SCHEMA
// ===========================================
export const newsletterSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(254, 'Email must be less than 254 characters')
    .toLowerCase(),
});

export type NewsletterData = z.infer<typeof newsletterSchema>;

// ===========================================
// ERROR PARSING HELPERS
// ===========================================
export const getFirstError = (error: z.ZodError): string => {
  return error.issues[0]?.message || 'Validation failed';
};

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
