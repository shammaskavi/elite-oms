import { z } from "zod";

/**
 * Shared Zod validators reused across forms. Keep validation rules in one place
 * so the rules behind "name", "phone", "email", etc. stay consistent.
 */

// Phone numbers validation — supports standard Indian (10 digits) and international numbers (E.164 standard: 7-15 digits starting with optional +)
export const phoneNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, ""))
  .refine(
    (v) => v === "" || /^\+?\d{7,15}$/.test(v),
    { message: "Enter a valid phone number (e.g., +15613077571 or 10-digit number)" }
  );

export const optionalPhone = phoneNumberSchema.optional().or(z.literal(""));

export const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .or(z.literal(""))
  .optional();

export const requiredName = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(120, "Name must be under 120 characters");

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Must be under ${max} characters`)
    .optional()
    .or(z.literal(""));

export const optionalDate = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine(
    (v) => !v || !Number.isNaN(Date.parse(v)),
    { message: "Enter a valid date" }
  );

export const customerSchema = z.object({
  name: requiredName,
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText(500),
  dob: optionalDate,
  anniversary: optionalDate,
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

export const positiveAmount = z
  .number({ invalid_type_error: "Enter a valid amount" })
  .positive("Amount must be greater than 0")
  .max(10_000_000, "Amount looks too large — please double check");

export const paymentSchema = z.object({
  amount: positiveAmount,
  date: z.string().min(1, "Date is required"),
  method: z.string().min(1, "Payment method is required"),
  note: optionalText(500),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;
