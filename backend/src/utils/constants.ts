// Allowed values for the string-typed "enum" columns in the Prisma schema.

export const ROLES = ["ATTENDEE", "ORGANIZER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const EVENT_STATUS = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "CANCELLED"] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];

export const TICKET_KINDS = ["PAID", "FREE", "PWYW"] as const;
export type TicketKind = (typeof TICKET_KINDS)[number];

export const CATEGORIES = ["Music", "Tech & business", "Food & markets", "Comedy", "Arts", "Outdoors", "Film"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PAYMENT_METHODS = ["TELEBIRR", "CBE_BIRR", "CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABEL: Record<string, string> = {
  TELEBIRR: "Telebirr",
  CBE_BIRR: "CBE Birr",
  CARD: "Card",
  FREE: "Free registration",
};

export const COVER_PRESETS = [
  "sunburst",
  "comedy",
  "stripes",
  "market",
  "night",
  "tech",
  "arts",
  "film",
  "split",
] as const;
export type CoverPreset = (typeof COVER_PRESETS)[number];

/** Platform fee on paid tickets. Buyers see one all-in price. */
export const FEE_RATE = 0.05;
/** How long tickets are held while a buyer checks out. */
export const HOLD_MINUTES = 10;
export const MAX_PER_ORDER = 6;
export const DEFAULT_CITY = "Addis Ababa";
export const TIME_ZONE = "Africa/Addis_Ababa";
export const CURRENCY = "ETB";

export const GATES = ["Gate A", "Gate B", "Gate C", "VIP entrance"] as const;
