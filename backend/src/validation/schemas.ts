import { z } from "zod";
import { CATEGORIES, COVER_PRESETS, MAX_PER_ORDER, PAYMENT_METHODS, TICKET_KINDS } from "../utils/constants";
import { isEmail, normalizePhone } from "../utils/phone";

export const emailField = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .refine(isEmail, "Add the ending, like .com or .et, so your tickets reach you.")
  .transform((v) => v.toLowerCase());

export const phoneField = z
  .string()
  .trim()
  .min(1, "Enter your mobile number.")
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Use an Ethiopian mobile number, like 0911 234 567." });
      return z.NEVER;
    }
    return p;
  });

export const optionalPhoneField = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Use an Ethiopian mobile number, like 0911 234 567." });
      return z.NEVER;
    }
    return p;
  });

export const nameField = z.string().trim().min(2, "Enter your full name.").max(80, "That name is too long.");
export const passwordField = z.string().min(8, "Use at least 8 characters.").max(100);

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});

export const registerSchema = z.object({
  name: nameField,
  email: emailField,
  phone: optionalPhoneField,
  password: passwordField,
  role: z.enum(["ATTENDEE", "ORGANIZER"]).default("ATTENDEE"),
  organizerName: z.string().trim().max(80).optional(),
});

export const profileSchema = z.object({
  name: nameField,
  phone: optionalPhoneField,
  city: z.string().trim().min(2).max(60).optional(),
  prefs: z
    .object({ smsReminder: z.boolean(), emailFollowed: z.boolean(), weeklyPicks: z.boolean() })
    .optional(),
});

export const holdSchema = z.object({
  eventId: z.string().min(1),
  source: z.string().trim().max(30).optional(),
  items: z
    .array(z.object({
        ticketTypeId: z.string().min(1),
        quantity: z.number().int().min(1).max(MAX_PER_ORDER),
        amount: z.number().int().min(0).max(1_000_000).optional(),
      }))
    .min(1, "Select at least one ticket."),
});

export const payOrderSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
  password: z.string().optional(),
  holders: z
    .array(z.object({ name: z.string().trim().max(80).optional(), contact: z.string().trim().max(120).optional() }))
    .default([]),
  method: z.enum(PAYMENT_METHODS).optional(),
  payPhone: z.string().trim().optional(),
});

export const assignTicketSchema = z.object({
  holderName: z.string().trim().min(2, "Enter the guest's name.").max(80),
  holderContact: z.string().trim().max(120).optional(),
});

const dateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time.");

export const eventBasicsSchema = z.object({
  title: z.string().trim().min(3, "Give your event a name (at least 3 characters).").max(100),
  category: z.enum(CATEGORIES),
  summary: z.string().trim().max(200).optional(),
});

export const eventWhenWhereSchema = z
  .object({
    startsAt: dateString,
    endsAt: dateString.optional().nullable(),
    gatesAt: dateString.optional().nullable(),
    venueName: z.string().trim().min(2, "Add the venue name.").max(100),
    venueAddress: z.string().trim().max(200).optional(),
    city: z.string().trim().min(2).max(60).default("Addis Ababa"),
    ageLimit: z.number().int().min(0).max(30).default(0),
    capacity: z.number().int().min(1, "Add the venue capacity.").max(200000),
  })
  .refine((v) => !v.endsAt || Date.parse(v.endsAt) > Date.parse(v.startsAt), {
    path: ["endsAt"],
    message: "The end time must be after the start.",
  })
  .refine((v) => !v.gatesAt || Date.parse(v.gatesAt) <= Date.parse(v.startsAt), {
    path: ["gatesAt"],
    message: "Gates should open before the event starts.",
  });

export const eventPageSchema = z.object({
  description: z.string().trim().min(20, "Describe the event in at least a couple of sentences.").max(5000),
  coverPreset: z.enum(COVER_PRESETS),
  coverText: z.string().trim().max(40).optional(),
  lineup: z
    .array(
      z.object({
        time: z.string().trim().max(20),
        name: z.string().trim().min(1).max(80),
        note: z.string().trim().max(120).optional(),
        headline: z.boolean().optional(),
      }),
    )
    .max(20)
    .default([]),
  info: z
    .object({
      entry: z.string().trim().max(400).optional(),
      refunds: z.string().trim().max(400).optional(),
      accessibility: z.string().trim().max(400).optional(),
      gettingThere: z.string().trim().max(400).optional(),
    })
    .default({}),
  refundUntil: dateString.optional().nullable(),
  salesEnd: dateString.optional().nullable(),
});

export const ticketTypeSchema = z
  .object({
    name: z.string().trim().min(2, "Name this ticket.").max(60),
    kind: z.enum(TICKET_KINDS).default("PAID"),
    price: z.number().int().min(0, "Price can't be negative.").max(1_000_000),
    quantity: z.number().int().min(1, "Add at least one ticket.").max(200000),
    description: z.string().trim().max(160).optional(),
    perOrderMax: z.number().int().min(1).max(MAX_PER_ORDER).default(MAX_PER_ORDER),
    saleStart: dateString.optional().nullable(),
    saleEnd: dateString.optional().nullable(),
  })
  .refine((v) => v.kind !== "PAID" || v.price >= 10, {
    path: ["price"],
    message: "Paid tickets start at ETB 10. Choose Free for no charge.",
  });

export const reportSchema = z.object({
  reason: z.enum(["Scam or fraud", "Impersonation", "Inappropriate content", "Wrong information", "Other"]),
  details: z.string().trim().max(500).optional(),
});

export const waitlistSchema = z.object({ phone: phoneField });

export const refundSchema = z.object({ reason: z.string().trim().max(300).optional() });

export const checkInSchema = z.object({
  code: z.string().trim().min(3, "Enter a ticket code.").max(40),
  gate: z.string().trim().max(30).optional(),
});

export const moderationSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "ASK_CHANGES", "SUSPEND_ORGANIZER", "UNPUBLISH", "CANCEL"]),
  note: z.string().trim().max(500).optional(),
});

/* ---- request bodies added when the API was split from the frontend ---- */

export const sectionSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("basics"), data: eventBasicsSchema }),
  z.object({ section: z.literal("where"), data: eventWhenWhereSchema }),
  z.object({ section: z.literal("page"), data: eventPageSchema }),
]);

export const ticketPatchSchema = assignTicketSchema.or(z.object({ acknowledgeReschedule: z.literal(true) }));

export const viewSchema = z.object({ source: z.string().max(30).optional() });

export const messageSchema = z.object({
  subject: z.string().trim().min(3, "Add a subject.").max(120),
  body: z.string().trim().min(5, "Write a short message.").max(1000),
});

export const refundDecisionSchema = z.object({ decision: z.enum(["APPROVE", "DECLINE"]) });

export const organizerProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your organization name.").max(80),
  description: z.string().trim().max(400).optional(),
  payoutBank: z.string().trim().max(60).optional(),
  payoutAccount: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, "Account numbers are 6 to 20 digits.")
    .optional()
    .or(z.literal("")),
});

export const manualCheckInSchema = z.object({ gate: z.string().max(30).optional() });

export const organizerActionSchema = z.object({
  action: z.enum(["VERIFY", "SUSPEND", "REINSTATE", "REQUEST_DETAILS", "VERIFY_PAYOUT"]),
  note: z.string().trim().max(400).optional(),
});

export const userStatusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });
export const reportStatusSchema = z.object({ status: z.enum(["RESOLVED", "DISMISSED"]) });
