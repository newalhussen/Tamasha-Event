// Shapes of the JSON the backend API returns. Dates arrive as ISO strings.
// Keep in sync with backend/src/services/*.ts (the API is the source of truth).

export type Role = "ATTENDEE" | "ORGANIZER" | "ADMIN";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string;
  role: Role;
  prefs: { smsReminder: boolean; emailFollowed: boolean; weeklyPicks: boolean };
  organizer: { id: string; name: string; slug: string; verified: boolean; status: string; payoutVerified: boolean } | null;
};

export type Phase = "UPCOMING" | "LIVE" | "ENDED";
export type TypeState = "ON_SALE" | "SOLD_OUT" | "NOT_YET" | "ENDED";

export type TicketTypeView = {
  id: string;
  name: string;
  kind: string;
  price: number;
  quantity: number;
  sold: number;
  held: number;
  left: number;
  description: string;
  perOrderMax: number;
  saleStart: string | null;
  saleEnd: string | null;
  state: TypeState;
};

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  venueName: string;
  venueAddress: string;
  city: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  phase: Phase;
  coverPreset: string;
  coverText: string;
  organizerName: string;
  organizerVerified: boolean;
  capacity: number;
  totalQuantity: number;
  sold: number;
  left: number;
  soldPct: number;
  soldOut: boolean;
  free: boolean;
  minPrice: number;
  rescheduled: boolean;
  cancelled: boolean;
  types: TicketTypeView[];
};

export type OrgEventRow = EventSummary & { gross: number; checkedIn: number; flag: string; reviewReason: string; ticketTypeCount: number };

/** An event row as stored (what Prisma returns, serialised). */
export type EventRecord = {
  id: string;
  organizerId: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  description: string;
  venueName: string;
  venueAddress: string;
  city: string;
  startsAt: string;
  endsAt: string | null;
  gatesAt: string | null;
  ageLimit: number;
  capacity: number;
  status: string;
  reviewReason: string;
  flag: string;
  coverPreset: string;
  coverText: string;
  lineup: { time: string; name: string; note?: string; headline?: boolean }[];
  info: { entry?: string; refunds?: string; accessibility?: string; gettingThere?: string };
  refundUntil: string | null;
  salesEnd: string | null;
  previousStartsAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketRecord = {
  id: string;
  code: string;
  orderId: string;
  seq: number;
  price: number;
  holderName: string;
  holderContact: string;
  status: string;
  checkedInAt: string | null;
  rescheduleAck: boolean;
  ticketType: { id: string; name: string; kind: string };
};

export type OrderRecord = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  total: number;
  paymentMethod: string | null;
  paymentError: string | null;
  holdExpiresAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
};

export type Checklist = { key: string; label: string; done: boolean }[];

export type ChartDay = { key: string; date: string; tickets: number };

export type AnalyticsView = {
  summary: EventSummary;
  orders: number;
  avgOrder: number;
  gross: number;
  fees: number;
  net: number;
  views: number;
  started: number;
  completed: number;
  conversion: number;
  startedRate: number;
  completionRate: number;
  abandoned: number;
  series: { key: string; date: string; total: number; day: number }[];
  soldOutMarks: { name: string; quantity: number; date: string | null }[];
  projected: string | null;
  byType: (TicketTypeView & { gross: number })[];
  sources: { key: string; label: string; count: number }[];
  phase: Phase;
};

export type When = "today" | "tomorrow" | "weekend" | "week" | "range" | "all";
export type PriceFilter = "any" | "free" | "under1000" | "1000to3000" | "over3000";
export type SortKey = "popular" | "date" | "price";

export type DiscoverResult = {
  total: number;
  featured: EventSummary | null;
  goingFast: EventSummary[];
  goingFastCount: number;
  grid: EventSummary[];
  gridTotal: number;
  rangeLabel: string | null;
  range: { start: string; end: string; label: string } | null;
};

export type Dashboard = {
  events: OrgEventRow[];
  next: OrgEventRow | null;
  liveCount: number;
  drafts: OrgEventRow[];
  cur: { gross: number; net: number; tickets: number };
  prev: { gross: number; net: number; tickets: number };
  netChange: number | null;
  ticketChange: number | null;
  turnUp: number | null;
  chart: ChartDay[];
  chartEvent: OrgEventRow | null;
  refundRequests: { id: string; createdAt: string; order: { event: { title: string } } }[];
  lowStock: { event: OrgEventRow; type: TicketTypeView }[];
  nextPayout: { event: OrgEventRow; amount: number; date: string } | null;
};

/** GET /organizer/events/:id */
export type EventDetail = {
  event: EventRecord & { setupStep?: number };
  phase: Phase;
  summary: EventSummary;
  checklist: Checklist;
  soldCount: number;
};
