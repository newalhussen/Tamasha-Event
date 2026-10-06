/* eslint-disable no-console */
// Seed data for the Ethiopian market (Addis Ababa). Dates are relative to the day you run it,
// so the demo always has upcoming events. Every account's password is 12345678.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { newTicketCode } from "../src/lib/codes";

const db = new PrismaClient();
const PASSWORD = "12345678";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = new Date();

/* ------------------------------------------------------------ helpers */

function addisDate(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(now.getTime() + offsetDays * DAY));
  return parts;
}
/** Date at hh:mm Addis time, `offsetDays` from today. */
const at = (offsetDays: number, hh: number, mm = 0) =>
  new Date(`${addisDate(offsetDays)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+03:00`);

let rng = 20261006;
const rand = () => {
  rng = (rng * 1664525 + 1013904223) % 4294967296;
  return rng / 4294967296;
};
const pick = <T>(a: readonly T[]): T => a[Math.floor(rand() * a.length)];
const chunk = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const usedTicketCodes = new Set<string>();
function ticketCode(): string {
  let c = newTicketCode();
  while (usedTicketCodes.has(c)) c = newTicketCode();
  usedTicketCodes.add(c);
  return c;
}
let orderNo = 10000; // generated order codes stay below the hand-written demo codes (TM-4xxxx)
const orderCode = () => `TM-${++orderNo}`;

/* ------------------------------------------------------------ names */

const FIRST_F = ["Almaz", "Aster", "Bethlehem", "Birtukan", "Eden", "Feven", "Hanan", "Helen", "Hiwot", "Liya", "Marta", "Meseret", "Rahel", "Selamawit", "Tigist", "Tsion", "Yodit", "Zewditu", "Gadise", "Chaltu", "Mulu", "Saba", "Nardos", "Fatuma", "Amina", "Kidist", "Rediet", "Ruth", "Sara", "Wegene"];
const FIRST_M = ["Abel", "Abenezer", "Biruk", "Dagim", "Dawit", "Eyob", "Fikadu", "Henok", "Kaleb", "Lemma", "Mikias", "Natnael", "Robel", "Samuel", "Surafel", "Tewodros", "Yared", "Yonatan", "Zelalem", "Tolera", "Dinsa", "Kidane", "Mohammed", "Hussein", "Bereket", "Mesfin", "Yonas", "Nahom", "Fitsum", "Teshome"];
const LAST = ["Tesfaye", "Bekele", "Alemu", "Girma", "Haile", "Kebede", "Mekonnen", "Negash", "Tadesse", "Wolde", "Worku", "Assefa", "Demissie", "Gebre", "Hailu", "Tekle", "Abebe", "Desta", "Lemma", "Mulugeta", "Kassahun", "Ahmed", "Seid", "Jemal", "Fikre", "Gizaw", "Teklu", "Belay", "Shiferaw", "Yilma"];

/* ------------------------------------------------------------ main */

async function main() {
  console.log("Resetting data…");
  await db.moderationLog.deleteMany();
  await db.report.deleteMany();
  await db.waitlistEntry.deleteMany();
  await db.savedEvent.deleteMany();
  await db.eventView.deleteMany();
  await db.refundRequest.deleteMany();
  await db.ticket.deleteMany();
  await db.order.deleteMany();
  await db.ticketType.deleteMany();
  await db.event.deleteMany();
  await db.organizer.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  /* ---- named accounts ---- */
  const mk = (name: string, email: string, role: string, phone: string) => ({
    id: randomUUID(), name, email, role, phone, passwordHash, city: "Addis Ababa", createdAt: new Date(now.getTime() - rand() * 200 * DAY),
  });
  const admin = mk("Selam Bekele", "admin@tamasha.et", "ADMIN", "0911000001");
  const dawit = mk("Dawit Mekonnen", "dawit@tamasha.et", "ORGANIZER", "0911000002");
  const hanna = mk("Hanna Girma", "hanna@tamasha.et", "ORGANIZER", "0911000003");
  const liya = mk("Liya Solomon", "liya@tamasha.et", "ORGANIZER", "0911000004");
  const selamawit = mk("Selamawit Haile", "selamawit@tamasha.et", "ORGANIZER", "0911000005");
  const yonas = mk("Yonas Alemu", "yonas@tamasha.et", "ORGANIZER", "0911000006");
  const bereket = mk("Bereket Haile", "bereket@tamasha.et", "ORGANIZER", "0911000007");
  const mesfin = mk("Mesfin Kebede", "mesfin@tamasha.et", "ORGANIZER", "0911000008");
  const kaleb = mk("Kaleb Tadesse", "kaleb@tamasha.et", "ORGANIZER", "0911000009");
  const meron = mk("Meron Tesfaye", "meron@tamasha.et", "ATTENDEE", "0912555014");
  const abel = mk("Abel Tekle", "abel@tamasha.et", "ATTENDEE", "0913555021");
  const hiwot = mk("Hiwot Alemayehu", "hiwot@tamasha.et", "ATTENDEE", "0914555032");
  const suspended = mk("Dagim Worku", "suspended@tamasha.et", "ATTENDEE", "0915555043");
  const named = [admin, dawit, hanna, liya, selamawit, yonas, bereket, mesfin, kaleb, meron, abel, hiwot, suspended];
  (suspended as any).status = "SUSPENDED";

  /* ---- background attendee pool ---- */
  const pool: ReturnType<typeof mk>[] = [];
  const seen = new Set(named.map((u) => u.email));
  while (pool.length < 190) {
    const female = rand() < 0.5;
    const first = pick(female ? FIRST_F : FIRST_M);
    const last = pick(LAST);
    const email = `${first}.${last}${pool.length + 1}@example.com`.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    pool.push(mk(`${first} ${last}`, email, "ATTENDEE", `09${Math.floor(10000000 + rand() * 89999999)}`));
  }
  for (const part of chunk([...named, ...pool], 100)) await db.user.createMany({ data: part as any });
  const buyers = [meron, abel, hiwot, ...pool];

  /* ---- organizers ---- */
  const org = (user: { id: string }, name: string, slug: string, o: Partial<{ verified: boolean; status: string; payoutBank: string; payoutAccount: string; payoutVerified: boolean; description: string; verificationNote: string }>) => ({
    id: randomUUID(), userId: user.id, name, slug, createdAt: new Date(now.getTime() - 120 * DAY), ...o,
  });
  const abay = org(dawit, "Abay Sound Collective", "abay-sound-collective", { verified: true, status: "VERIFIED", payoutBank: "Commercial Bank of Ethiopia", payoutAccount: "1000123454410", payoutVerified: true, description: "Live bands and DJs on Addis rooftops since 2021." });
  const zema = org(hanna, "Zema Events", "zema-events", { verified: true, status: "VERIFIED", payoutBank: "Awash Bank", payoutAccount: "013200488125", payoutVerified: true, description: "Comedy, supper clubs, film nights and community markets." });
  const skylight = org(liya, "Skylight Jazz Club", "skylight-jazz-club", { verified: true, status: "VERIFIED", payoutBank: "Dashen Bank", payoutAccount: "5011230045671", payoutVerified: true, description: "Addis' home for live jazz." });
  const birhan = org(selamawit, "Birhan Studio", "birhan-studio", { verified: false, status: "PENDING", payoutBank: "Bank of Abyssinia", payoutAccount: "84917710221", payoutVerified: true, description: "Pottery and clay workshops in Bole.", verificationNote: "" });
  const stride = org(yonas, "Selam Stride Club", "selam-stride-club", { verified: false, status: "PENDING", payoutBank: "Awash Bank", payoutAccount: "013200771934", payoutVerified: true, description: "Trail running community." });
  const bigtime = org(bereket, "Bigtime Promotions ET", "bigtime-promotions-et", { verified: false, status: "PENDING", description: "Large-scale festivals." });
  const lowtide = org(mesfin, "Abay Sound Events ET", "abay-sound-events-et", { verified: false, status: "PENDING", payoutBank: "Awash Bank", payoutAccount: "013200999001", payoutVerified: false, description: "Concerts and nightlife." });
  const kinvest = org(kaleb, "K-Invest Academy", "k-invest-academy", { verified: false, status: "PENDING", payoutBank: "Dashen Bank", payoutAccount: "5011239998811", payoutVerified: true, description: "Investment education." });
  await db.organizer.createMany({ data: [abay, zema, skylight, birhan, stride, bigtime, lowtide, kinvest] });

  /* ---- events ---- */
  type TT = { name: string; kind?: string; price: number; qty: number; sold: number; desc?: string; early?: boolean };
  type Ev = {
    id: string; o: { id: string }; slug: string; title: string; category: string; summary: string; description: string;
    venue: string; address: string; startsAt: Date; endsAt?: Date; gatesAt?: Date; age: number; capacity: number; status: string;
    preset: string; text: string; types: TT[]; publishedAgo: number; flag?: string; reviewReason?: string; submittedAt?: Date;
    refundDays?: number; lineup?: unknown[]; info?: Record<string, string>; checkedPct?: number; previousStartsAt?: Date;
    cancelledAt?: Date; featured?: boolean; viewsPer?: number; noRefundWindow?: boolean;
  };
  const evs: Ev[] = [];
  const ev = (e: Omit<Ev, "id">) => { const full = { ...e, id: randomUUID() }; evs.push(full); return full; };

  const sautiInfo = {
    entry: "Show the QR code on your ticket. Bring a national ID, passport or driving licence: this event is 18 and over.",
    refunds: "Full refund until three days before the event. After that you can transfer a ticket to a friend at no cost, up to gates opening.",
    accessibility: "Step-free lift access to the rooftop and an accessible washroom on the 4th floor. Reserved seating on request.",
    gettingThere: "Limited basement parking. Ride-hail drop-off is at the main gate on Bole Road.",
  };

  const flagship = ev({
    o: abay, slug: "abay-rooftop-sessions-vol-9", title: "Abay Rooftop Sessions Vol. 9", category: "Music",
    summary: "Live bands and DJs on one open-air rooftop stage, until 1 AM.",
    description: "Four floors above Bole, Abay brings live bands and DJs together on one open-air stage. Volume 9 leans into Ethio-jazz: krar and masinqo meet late-night house, played back to back until one in the morning.\n\nCome early for the sunset warm-up. There are two bars, food from three local kitchens and a covered deck if the short rains arrive.",
    venue: "Skyline Rooftop", address: "4th floor, Skyline Building, Bole Road, Addis Ababa", startsAt: at(11, 19), endsAt: at(12, 1), gatesAt: at(11, 18), age: 18, capacity: 520, status: "PUBLISHED",
    preset: "sunburst", text: "ABAY\nVOL. 9", publishedAgo: 30, refundDays: 3, featured: true, viewsPer: 9,
    types: [
      { name: "Early Bird", price: 800, qty: 100, sold: 100, early: true },
      { name: "General Admission", price: 1200, qty: 340, sold: 278 },
      { name: "VIP Deck", price: 3000, qty: 40, sold: 31, desc: "Reserved deck seating and a welcome drink" },
      { name: "Student", price: 700, qty: 40, sold: 29, desc: "Student ID checked at the gate" },
    ],
    lineup: [
      { time: "7:00 PM", name: "DJ Nardos", note: "Sunset warm-up" },
      { time: "8:30 PM", name: "Azmari Trio", note: "Live set" },
      { time: "10:00 PM", name: "Gojo & The Blue Nile Band", note: "Full band, 75 minutes", headline: true },
      { time: "11:30 PM", name: "Eyob b2b Tsion", note: "Closing set until 1:00 AM" },
    ],
    info: sautiInfo,
  });
  ev({
    o: abay, slug: "abay-rooftop-sessions-vol-10", title: "Abay Rooftop Sessions Vol. 10", category: "Music",
    summary: "The next chapter on the Skyline rooftop.", description: "Volume 10 of the rooftop series. Line-up announced in two weeks. Early birds go first.",
    venue: "Skyline Rooftop", address: "4th floor, Skyline Building, Bole Road, Addis Ababa", startsAt: at(39, 19), endsAt: at(40, 1), gatesAt: at(39, 18), age: 18, capacity: 520, status: "PUBLISHED",
    preset: "night", text: "ABAY\nVOL. 10", publishedAgo: 14, refundDays: 3,
    types: [
      { name: "Early Bird", price: 600, qty: 120, sold: 98, early: true },
      { name: "General Admission", price: 1000, qty: 340, sold: 23 },
      { name: "VIP Deck", price: 2500, qty: 40, sold: 0 },
      { name: "Student", price: 600, qty: 20, sold: 0 },
    ],
    info: sautiInfo,
  });
  ev({
    o: abay, slug: "vinyl-night-ethio-jazz-listening-room", title: "Vinyl Night: Ethio-Jazz Listening Room", category: "Music",
    summary: "Rare pressings, great speakers, no talking over the record.", description: "A listening room for 120 people. Crate-diggers play full sides of Ethio-jazz and golden-age Addis records on a proper sound system.",
    venue: "The Depot", address: "Kazanchis, Addis Ababa", startsAt: at(24, 20), endsAt: at(24, 23, 30), gatesAt: at(24, 19, 30), age: 0, capacity: 120, status: "PUBLISHED",
    preset: "stripes", text: "", publishedAgo: 18, refundDays: 3,
    types: [{ name: "Entry", price: 900, qty: 120, sold: 64 }],
  });
  ev({
    o: abay, slug: "genna-eve-on-the-roof", title: "Genna Eve on the Roof", category: "Music",
    summary: "", description: "", venue: "Skyline Rooftop", address: "", startsAt: at(92, 20), age: 0, capacity: 0, status: "DRAFT",
    preset: "night", text: "", publishedAgo: 0, types: [],
  });
  ev({
    o: abay, slug: "abay-rooftop-sessions-vol-8", title: "Abay Rooftop Sessions Vol. 8", category: "Music",
    summary: "Last month's sold-out rooftop.", description: "Vol. 8 filled the rooftop. Thanks to everyone who came.",
    venue: "Skyline Rooftop", address: "4th floor, Skyline Building, Bole Road, Addis Ababa", startsAt: at(-24, 19), endsAt: at(-23, 1), gatesAt: at(-24, 18), age: 18, capacity: 520, status: "PUBLISHED",
    preset: "sunburst", text: "ABAY\nVOL. 8", publishedAgo: 55, refundDays: 3, checkedPct: 91, viewsPer: 8,
    types: [
      { name: "Early Bird", price: 500, qty: 100, sold: 100, early: true },
      { name: "General Admission", price: 900, qty: 340, sold: 333 },
      { name: "VIP Deck", price: 2500, qty: 40, sold: 40 },
      { name: "Student", price: 500, qty: 40, sold: 29 },
    ],
  });
  ev({
    o: abay, slug: "abay-late-shift-live", title: "Abay Late Shift: Ethio-Jazz Live", category: "Music",
    summary: "A Tuesday-night live session. Happening now.", description: "The mid-week session: one band, one room, no phones on the floor.",
    venue: "The Depot", address: "Kazanchis, Addis Ababa", startsAt: new Date(now.getTime() - 2 * HOUR), endsAt: new Date(now.getTime() + 5 * HOUR), gatesAt: new Date(now.getTime() - 3 * HOUR), age: 0, capacity: 260, status: "PUBLISHED",
    preset: "stripes", text: "LATE\nSHIFT", publishedAgo: 20, refundDays: 1, checkedPct: 71,
    types: [
      { name: "General Admission", price: 500, qty: 200, sold: 180 },
      { name: "VIP Deck", price: 1500, qty: 30, sold: 24 },
      { name: "Student", price: 300, qty: 30, sold: 14 },
    ],
  });

  // Zema Events
  ev({
    o: zema, slug: "comedy-night-stand-up-at-the-depot", title: "Comedy Night: Stand-up at The Depot", category: "Comedy",
    summary: "Five comics, one mic, zero filters.", description: "Five of Addis' sharpest stand-up comics trade sets in English and Amharic. Bring a friend who laughs loudly.",
    venue: "The Depot", address: "Kazanchis, Addis Ababa", startsAt: at(9, 20), endsAt: at(9, 22, 30), gatesAt: at(9, 19, 15), age: 16, capacity: 80, status: "PUBLISHED",
    preset: "comedy", text: "", publishedAgo: 12, refundDays: 2,
    types: [{ name: "General Admission", price: 600, qty: 80, sold: 66 }],
  });
  ev({
    o: zema, slug: "supper-club-gursha-and-tej", title: "Supper Club: Gursha & Tej", category: "Food & markets",
    summary: "A seven-course Ethiopian tasting table with honey wine pairings.", description: "A shared-table supper built around gursha, the Ethiopian act of feeding someone you care about. Seven courses, each paired with house tej.",
    venue: "Mesob Table", address: "Bole Medhanialem, Addis Ababa", startsAt: at(11, 18, 30), endsAt: at(11, 22), gatesAt: at(11, 18), age: 18, capacity: 40, status: "PUBLISHED",
    preset: "market", text: "", publishedAgo: 16, refundDays: 3,
    types: [{ name: "Seat at the table", price: 2500, qty: 40, sold: 34 }],
  });
  const film = ev({
    o: zema, slug: "film-under-the-stars-double-bill", title: "Film Under the Stars: Double Bill", category: "Film",
    summary: "Two classics of Ethiopian cinema on an open-air lawn.", description: "Bring a blanket. Two Ethiopian classics screened back to back on the lawn, with hot buna and sambusa from the cart.",
    venue: "Alliance Éthio-Française Lawn", address: "Arat Kilo, Addis Ababa", startsAt: at(18, 19, 15), endsAt: at(18, 23), gatesAt: at(18, 18, 30), age: 0, capacity: 120, status: "PUBLISHED",
    preset: "film", text: "", publishedAgo: 20, refundDays: 11, previousStartsAt: at(11, 19, 15),
    types: [{ name: "General Admission", price: 500, qty: 120, sold: 89 }],
  });
  ev({
    o: zema, slug: "sunday-slow-market", title: "Sunday Slow Market", category: "Food & markets",
    summary: "Makers, roasters and bakers. Free, but register.", description: "A slow Sunday market: coffee roasters, potters, bakers and print makers. Free entry; register so we can plan seating and shade.",
    venue: "Makers' Shed", address: "Bole Medhanialem, Addis Ababa", startsAt: at(12, 10), endsAt: at(12, 16), age: 0, capacity: 300, status: "PUBLISHED",
    preset: "market", text: "", publishedAgo: 9,
    types: [{ name: "Free registration", kind: "FREE", price: 0, qty: 300, sold: 112 }],
  });
  ev({
    o: zema, slug: "entoto-sunrise-run-10k", title: "Entoto Sunrise Run 10K", category: "Outdoors",
    summary: "Run above the city as the sun comes up.", description: "A 10K loop on the Entoto ridge, starting at sunrise. Water stations at 3K and 7K, buna at the finish. Altitude: 3,000 m. Pace yourself.",
    venue: "Entoto Park Gate", address: "Entoto Hills, Addis Ababa", startsAt: at(12, 6), endsAt: at(12, 10), gatesAt: at(12, 5, 15), age: 0, capacity: 400, status: "PUBLISHED",
    preset: "night", text: "", publishedAgo: 25, refundDays: 5,
    types: [{ name: "Runner entry", price: 700, qty: 400, sold: 120 }],
  });
  ev({
    o: zema, slug: "build-addis-product-and-design-day", title: "Build Addis: Product & Design Day", category: "Tech & business",
    summary: "A day of talks and workshops for people who build products.", description: "Talks, workshops and hallway conversations with product managers, designers and engineers building for Ethiopia and beyond.",
    venue: "Foundry Hub", address: "Bole, Addis Ababa", startsAt: at(11, 9), endsAt: at(11, 17), gatesAt: at(11, 8, 15), age: 0, capacity: 260, status: "PUBLISHED",
    preset: "tech", text: "", publishedAgo: 26, refundDays: 4,
    types: [
      { name: "Standard", price: 2500, qty: 200, sold: 90 },
      { name: "Student", price: 1200, qty: 60, sold: 22 },
    ],
  });
  ev({
    o: zema, slug: "addis-founders-breakfast-no-14", title: "Addis Founders' Breakfast No. 14", category: "Tech & business",
    summary: "Buna, injera firfir and honest founder conversations.", description: "A small monthly breakfast for founders and operators. No pitches, no slides.",
    venue: "Foundry Hub", address: "Bole, Addis Ababa", startsAt: at(10, 7, 30), endsAt: at(10, 9, 30), age: 0, capacity: 60, status: "PUBLISHED",
    preset: "split", text: "", publishedAgo: 10,
    types: [{ name: "Free registration", kind: "FREE", price: 0, qty: 60, sold: 41 }],
  });
  ev({
    o: zema, slug: "azmari-reimagined-live-orchestra", title: "Azmari Reimagined: Live Orchestra", category: "Music",
    summary: "Azmari songs rearranged for a 14-piece orchestra.", description: "Azmari storytelling songs, rewritten for strings, brass and krar. One night, one hall, fourteen players.",
    venue: "Meskerem Hall", address: "Piassa, Addis Ababa", startsAt: at(11, 19, 30), endsAt: at(11, 22), gatesAt: at(11, 18, 45), age: 0, capacity: 400, status: "PUBLISHED",
    preset: "stripes", text: "", publishedAgo: 22, refundDays: 3,
    types: [
      { name: "Standard", price: 1500, qty: 300, sold: 177 },
      { name: "Front rows", price: 2800, qty: 100, sold: 62 },
    ],
  });
  ev({
    o: zema, slug: "eskista-and-funk-night", title: "Eskista & Funk Night with the Lakeside Seven", category: "Music",
    summary: "Seven-piece funk band, one dance floor.", description: "The Lakeside Seven play eskista-inflected funk from open to close. Wear shoes you can move in.",
    venue: "The Depot", address: "Kazanchis, Addis Ababa", startsAt: at(17, 20), endsAt: at(18, 0, 30), gatesAt: at(17, 19), age: 18, capacity: 300, status: "PUBLISHED",
    preset: "night", text: "", publishedAgo: 12, refundDays: 3,
    types: [{ name: "General Admission", price: 900, qty: 300, sold: 71 }],
  });
  ev({
    o: zema, slug: "addis-design-week-opening-talks", title: "Addis Design Week: Opening Talks", category: "Tech & business",
    summary: "Opening talks of Addis Design Week.", description: "Opening talks to kick off Design Week.",
    venue: "Foundry Hub", address: "Bole, Addis Ababa", startsAt: at(-40, 17), endsAt: at(-40, 20), age: 0, capacity: 150, status: "PUBLISHED",
    preset: "tech", text: "", publishedAgo: 60, refundDays: 2, checkedPct: 88,
    types: [{ name: "General Admission", price: 400, qty: 150, sold: 131 }],
  });

  // Skylight Jazz Club
  ev({
    o: skylight, slug: "jazz-at-skylight", title: "Jazz at Skylight", category: "Music",
    summary: "An evening of live jazz in the club's main room.", description: "Quartet sets, a guest horn player and a late jam. Doors open at 7.",
    venue: "Skylight Ballroom", address: "Bole, Addis Ababa", startsAt: at(15, 20), endsAt: at(15, 23, 30), gatesAt: at(15, 19), age: 0, capacity: 220, status: "PUBLISHED",
    preset: "sunburst", text: "", publishedAgo: 20, refundDays: 3, flag: "Venue changed after 57 sales", submittedAt: new Date(now.getTime() - 5 * HOUR),
    types: [{ name: "General Admission", price: 1500, qty: 200, sold: 57 }],
  });

  // Birhan Studio
  ev({
    o: birhan, slug: "ink-and-clay-open-studio-night", title: "Ink & Clay: Open Studio Night", category: "Arts",
    summary: "Print and pottery stations, open until late.", description: "Try block printing and hand-building at open stations. All materials included.",
    venue: "Birhan Studio", address: "Bole, Addis Ababa", startsAt: at(10, 18), endsAt: at(10, 21), age: 0, capacity: 30, status: "PUBLISHED",
    preset: "arts", text: "", publishedAgo: 15, refundDays: 2,
    types: [{ name: "Studio seat", price: 500, qty: 30, sold: 30 }],
  });
  ev({
    o: birhan, slug: "pottery-for-two", title: "Pottery for Two", category: "Arts",
    summary: "Throw a pot together. Two seats, one wheel.", description: "A relaxed two-hour wheel session for couples and friends, with a glazed piece to collect next week.",
    venue: "Birhan Studio", address: "Bole, Addis Ababa", startsAt: at(12, 14), endsAt: at(12, 16), age: 0, capacity: 20, status: "PUBLISHED",
    preset: "arts", text: "", publishedAgo: 11, refundDays: 3,
    types: [{ name: "Pair", price: 2000, qty: 20, sold: 18 }],
  });
  const cancelled = ev({
    o: birhan, slug: "kuraz-clay-night", title: "Kuraz Clay Night", category: "Arts",
    summary: "Cancelled by the organizer.", description: "A clay night that had to be cancelled.",
    venue: "Birhan Studio", address: "Bole, Addis Ababa", startsAt: at(9, 18), endsAt: at(9, 21), age: 0, capacity: 24, status: "CANCELLED",
    preset: "arts", text: "", publishedAgo: 20, refundDays: 2, cancelledAt: at(-4, 11),
    types: [{ name: "Studio seat", price: 800, qty: 24, sold: 11 }],
  });

  // Moderation-queue events
  ev({
    o: lowtide, slug: "abay-rooftop-sessions-vol-10-2", title: "Abay Rooftop Sessions Vol. 10", category: "Music",
    summary: "Vol. 10 of the rooftop sessions.", description: "Vol. 10 of the rooftop sessions on the Skyline rooftop. Limited tickets.",
    venue: "Skyline Rooftop", address: "Bole, Addis Ababa", startsAt: at(39, 19), endsAt: at(40, 1), age: 18, capacity: 500, status: "PENDING_REVIEW",
    preset: "night", text: "ABAY\nVOL. 10", publishedAgo: 0, flag: "Possible impersonation", submittedAt: new Date(now.getTime() - 26 * HOUR), refundDays: 3,
    types: [{ name: "General Admission", price: 700, qty: 500, sold: 0 }],
  });
  ev({
    o: bigtime, slug: "mega-fest-addis", title: "Mega Fest Addis", category: "Music",
    summary: "A two-stage festival.", description: "Two stages, 20 acts, food court and a late-night finale. Full line-up soon.",
    venue: "Meskel Square", address: "Meskel Square, Addis Ababa", startsAt: at(60, 14), endsAt: at(60, 23), age: 0, capacity: 5000, status: "PENDING_REVIEW",
    preset: "split", text: "MEGA\nFEST", publishedAgo: 0, flag: "5,000 capacity, payout unverified", submittedAt: new Date(now.getTime() - 3 * HOUR), refundDays: 7,
    types: [{ name: "General Admission", price: 800, qty: 5000, sold: 0 }],
  });
  ev({
    o: stride, slug: "entoto-trail-half-marathon", title: "Entoto Trail Half Marathon", category: "Outdoors",
    summary: "21K on the Entoto forest trails.", description: "A half marathon on the Entoto forest trails with aid stations every 4K and a finish-line buna ceremony.",
    venue: "Entoto Forest Trailhead", address: "Entoto Hills, Addis Ababa", startsAt: at(35, 6, 30), endsAt: at(35, 12), age: 0, capacity: 300, status: "PENDING_REVIEW",
    preset: "night", text: "", publishedAgo: 0, flag: "First event", submittedAt: new Date(now.getTime() - 40 * 60_000), refundDays: 7,
    types: [{ name: "Runner entry", price: 1000, qty: 300, sold: 0 }],
  });
  const wealth = ev({
    o: kinvest, slug: "birr-wealth-masterclass", title: "Birr Wealth Masterclass", category: "Tech & business",
    summary: "Turn savings into 10x returns.", description: "A masterclass promising guaranteed returns on investments.",
    venue: "Hotel conference room", address: "Addis Ababa", startsAt: at(14, 10), endsAt: at(14, 16), age: 0, capacity: 200, status: "PUBLISHED",
    preset: "tech", text: "", publishedAgo: 6, flag: "Reported by 4 people", submittedAt: new Date(now.getTime() - 9 * HOUR), refundDays: 1,
    types: [{ name: "Seat", price: 1500, qty: 200, sold: 7 }],
  });

  /* ---- persist events and ticket types ---- */
  const typeRows: any[] = [];
  const typeIds = new Map<Ev, { id: string; t: TT }[]>();
  for (const e of evs) {
    const publishedAt = e.status === "DRAFT" ? null : new Date(now.getTime() - e.publishedAgo * DAY);
    e.types.forEach((t, i) => {
      const id = randomUUID();
      typeRows.push({
        id, eventId: e.id, name: t.name, kind: t.kind ?? "PAID", price: t.price, quantity: t.qty, description: t.desc ?? "", perOrderMax: 6, sortOrder: i,
      });
      typeIds.set(e, [...(typeIds.get(e) ?? []), { id, t }]);
    });
    await db.event.create({
      data: {
        id: e.id, organizerId: e.o.id, slug: e.slug, title: e.title, category: e.category, summary: e.summary, description: e.description,
        venueName: e.venue, venueAddress: e.address, city: "Addis Ababa", startsAt: e.startsAt, endsAt: e.endsAt ?? null, gatesAt: e.gatesAt ?? null,
        ageLimit: e.age, capacity: e.capacity, status: e.status, coverPreset: e.preset, coverText: e.text,
        lineup: JSON.stringify(e.lineup ?? []), info: JSON.stringify(e.info ?? {}),
        refundUntil: e.refundDays ? new Date(e.startsAt.getTime() - e.refundDays * DAY) : null,
        previousStartsAt: e.previousStartsAt ?? null, cancelledAt: e.cancelledAt ?? null,
        flag: e.flag ?? "", reviewReason: e.reviewReason ?? "", submittedAt: e.submittedAt ?? null,
        featured: !!e.featured, publishedAt, createdAt: new Date(now.getTime() - (e.publishedAgo + 3) * DAY),
      },
    });
  }
  await db.ticketType.createMany({ data: typeRows });

  /* ---- orders & tickets ---- */
  const orders: any[] = [];
  const tickets: any[] = [];
  const sourceFor = () => {
    const r = rand();
    return r < 0.41 ? "instagram" : r < 0.67 ? "discover" : r < 0.85 ? "whatsapp" : r < 0.96 ? "direct" : "other";
  };
  const staffGate = ["Gate A", "Gate B", "Gate A", "Gate C"];

  for (const e of evs) {
    if (e.status === "DRAFT" || e.status === "PENDING_REVIEW") continue;
    const start = new Date(now.getTime() - e.publishedAgo * DAY);
    const end = e.startsAt < now ? e.startsAt : now;
    const ticketList: any[] = [];
    for (const { id: typeId, t } of typeIds.get(e) ?? []) {
      let remaining = t.sold;
      while (remaining > 0) {
        const size = Math.min(remaining, t.kind === "FREE" ? 1 : 1 + Math.floor(rand() * 3));
        remaining -= size;
        const u = rand();
        const f = t.early ? Math.pow(u, 1.8) * 0.25 : Math.pow(u, 0.6);
        const paidAt = new Date(start.getTime() + (end.getTime() - start.getTime()) * f);
        const buyer = pick(buyers);
        const orderId = randomUUID();
        const price = t.kind === "FREE" ? 0 : t.price;
        const cancelled = e.status === "CANCELLED";
        orders.push({
          id: orderId, code: orderCode(), userId: buyer.id, eventId: e.id, name: buyer.name, email: buyer.email, phone: buyer.phone ?? "",
          status: cancelled ? "REFUNDED" : "PAID", total: price * size, paymentMethod: price === 0 ? "FREE" : pick(["TELEBIRR", "TELEBIRR", "CBE_BIRR", "CARD"]),
          paymentRef: price === 0 ? null : `TB${Math.floor(rand() * 1e9)}`, source: sourceFor(), holdExpiresAt: new Date(paidAt.getTime() + 10 * 60_000),
          paidAt, refundedAt: cancelled ? e.cancelledAt : null, createdAt: new Date(paidAt.getTime() - 3 * 60_000),
        });
        for (let s = 1; s <= size; s++) {
          const guest = s > 1 && rand() < 0.5 ? pick(pool).name : "";
          ticketList.push({
            id: randomUUID(), code: ticketCode(), orderId, eventId: e.id, ticketTypeId: typeId, ownerId: buyer.id, seq: s, price,
            holderName: s === 1 ? buyer.name : guest, holderContact: s === 1 ? buyer.email : "", status: cancelled ? "REFUNDED" : "VALID", createdAt: paidAt,
            rescheduleAck: false,
          });
        }
      }
    }
    // Check-ins
    if (e.checkedPct) {
      const valid = ticketList.filter((t) => t.status === "VALID");
      const n = Math.round((valid.length * e.checkedPct) / 100);
      valid.sort(() => rand() - 0.5);
      for (const t of valid.slice(0, n)) {
        const arrival = new Date(e.startsAt.getTime() - 60 * 60_000 + rand() * 150 * 60_000);
        t.status = "CHECKED_IN";
        t.checkedInAt = arrival < now ? arrival : new Date(now.getTime() - rand() * 40 * 60_000);
        t.checkedInById = dawit.id;
        t.gate = pick(staffGate);
      }
    }
    tickets.push(...ticketList);
  }

  /* ---- Meron's hand-written orders (demo attendee) ---- */
  const byEvent = (slug: string) => evs.find((e) => e.slug === slug)!;
  const tType = (e: Ev, name: string) => typeIds.get(e)!.find((x) => x.t.name === name)!.id;
  const demoOrder = (e: Ev, typeName: string, qty: number, status: string, code: string, ticketCodes: string[], opts: { checked?: boolean; paidDaysAgo?: number; second?: string } = {}) => {
    const orderId = randomUUID();
    const t = typeIds.get(e)!.find((x) => x.t.name === typeName)!;
    const price = t.t.kind === "FREE" ? 0 : t.t.price;
    const paidAt = new Date(now.getTime() - (opts.paidDaysAgo ?? 2) * DAY);
    orders.push({
      id: orderId, code, userId: meron.id, eventId: e.id, name: meron.name, email: meron.email, phone: meron.phone, status: status === "REFUNDED" ? "REFUNDED" : "PAID",
      total: price * qty, paymentMethod: price === 0 ? "FREE" : "TELEBIRR", paymentRef: price === 0 ? null : "TB48213XYZ", source: "instagram",
      holdExpiresAt: new Date(paidAt.getTime() + 10 * 60_000), paidAt, refundedAt: status === "REFUNDED" ? at(-4, 11) : null, createdAt: paidAt,
    });
    for (let s = 1; s <= qty; s++) {
      usedTicketCodes.add(ticketCodes[s - 1]);
      tickets.push({
        id: randomUUID(), code: ticketCodes[s - 1], orderId, eventId: e.id, ticketTypeId: t.id, ownerId: meron.id, seq: s, price,
        holderName: s === 1 ? meron.name : opts.second ?? "", holderContact: s === 1 ? meron.email : "",
        status: status === "REFUNDED" ? "REFUNDED" : opts.checked ? "CHECKED_IN" : "VALID", createdAt: paidAt,
        checkedInAt: opts.checked ? new Date(e.startsAt.getTime() + 52 * 60_000) : null, checkedInById: opts.checked ? dawit.id : null, gate: opts.checked ? "Gate A" : null,
        rescheduleAck: false,
      });
    }
  };
  // Two General Admission tickets for the flagship; the second has no guest name yet.
  demoOrder(flagship, "General Admission", 2, "PAID", "TM-48213", ["TMS-7K4Q-92XD", "TMS-7K4Q-93HB"], { paidDaysAgo: 1 });
  demoOrder(byEvent("addis-founders-breakfast-no-14"), "Free registration", 1, "PAID", "TM-48190", ["TMS-FB14-2WQ7"], { paidDaysAgo: 3 });
  demoOrder(film, "General Admission", 1, "PAID", "TM-48144", ["TMS-FILM-6C3N"], { paidDaysAgo: 5 });
  demoOrder(byEvent("abay-rooftop-sessions-vol-8"), "General Admission", 1, "PAID", "TM-46021", ["TMS-V8GA-4HZ5"], { checked: true, paidDaysAgo: 40 });
  demoOrder(byEvent("addis-design-week-opening-talks"), "General Admission", 1, "PAID", "TM-45510", ["TMS-DW01-8KP2"], { checked: true, paidDaysAgo: 50 });
  demoOrder(cancelled, "Studio seat", 1, "REFUNDED", "TM-47202", ["TMS-KCN1-9RT6"], { paidDaysAgo: 12 });

  // Abel and Hiwot get a couple of orders so every attendee login has content.
  const quick = (u: typeof abel, e: Ev, typeName: string, qty: number, code: string, tc: string[]) => {
    const orderId = randomUUID();
    const t = typeIds.get(e)!.find((x) => x.t.name === typeName)!;
    const paidAt = new Date(now.getTime() - 2 * DAY);
    orders.push({ id: orderId, code, userId: u.id, eventId: e.id, name: u.name, email: u.email, phone: u.phone, status: "PAID", total: t.t.price * qty, paymentMethod: "CBE_BIRR", paymentRef: "CB77ABC", source: "whatsapp", holdExpiresAt: paidAt, paidAt, createdAt: paidAt });
    for (let s = 1; s <= qty; s++) {
      usedTicketCodes.add(tc[s - 1]);
      tickets.push({ id: randomUUID(), code: tc[s - 1], orderId, eventId: e.id, ticketTypeId: t.id, ownerId: u.id, seq: s, price: t.t.price, holderName: s === 1 ? u.name : "", holderContact: s === 1 ? u.email : "", status: "VALID", createdAt: paidAt, rescheduleAck: false });
    }
  };
  quick(abel, byEvent("comedy-night-stand-up-at-the-depot"), "General Admission", 2, "TM-48250", ["TMS-ABL1-3MQ8", "TMS-ABL1-4NR9"]);
  quick(hiwot, byEvent("supper-club-gursha-and-tej"), "Seat at the table", 1, "TM-48251", ["TMS-HWT1-5PS2"]);

  console.log(`Writing ${orders.length} orders and ${tickets.length} tickets…`);
  for (const part of chunk(orders, 150)) await db.order.createMany({ data: part });
  for (const part of chunk(tickets, 150)) await db.ticket.createMany({ data: part });

  /* ---- waitlist, views, reports, saved, refund requests, logs ---- */
  const inkClay = byEvent("ink-and-clay-open-studio-night");
  await db.waitlistEntry.createMany({
    data: Array.from({ length: 12 }, (_, i) => ({ eventId: inkClay.id, phone: `0916${String(100000 + i * 7919).slice(0, 6)}` })),
  });

  const views: any[] = [];
  for (const e of evs) {
    if (!["PUBLISHED", "CANCELLED"].includes(e.status)) continue;
    const soldN = e.types.reduce((s, t) => s + t.sold, 0);
    const n = Math.round(soldN * (e.viewsPer ?? 7) * 0.8) + 25;
    const start = now.getTime() - e.publishedAgo * DAY;
    const end = e.startsAt < now ? e.startsAt.getTime() : now.getTime();
    for (let i = 0; i < n; i++) views.push({ id: randomUUID(), eventId: e.id, source: sourceFor(), at: new Date(start + (end - start) * Math.pow(rand(), 0.7)) });
  }
  for (const part of chunk(views, 400)) await db.eventView.createMany({ data: part });

  // Abandoned checkouts feed the funnel ("started checkout and left").
  const abandoned: any[] = [];
  for (const e of [flagship, byEvent("abay-rooftop-sessions-vol-8")]) {
    const gaType = tType(e, "General Admission");
    for (let i = 0; i < 40; i++) {
      const at0 = new Date(now.getTime() - rand() * 25 * DAY);
      abandoned.push({ id: randomUUID(), code: orderCode(), userId: null, eventId: e.id, name: "", email: "", phone: "", status: "EXPIRED", total: 1200, source: sourceFor(), holdExpiresAt: new Date(at0.getTime() + 10 * 60_000), createdAt: at0 });
    }
    void gaType;
  }
  for (const part of chunk(abandoned, 100)) await db.order.createMany({ data: part });

  for (let i = 0; i < 4; i++) {
    await db.report.create({
      data: { eventId: wealth.id, reporterId: pick(pool).id, reason: pick(["Scam or fraud", "Scam or fraud", "Wrong information"]), details: "Promises guaranteed returns.", createdAt: new Date(now.getTime() - (9 - i) * HOUR) },
    });
  }
  await db.report.create({ data: { eventId: byEvent("comedy-night-stand-up-at-the-depot").id, reporterId: abel.id, reason: "Wrong information", details: "Listed start time looks off.", createdAt: new Date(now.getTime() - 30 * HOUR) } });
  await db.savedEvent.createMany({ data: [{ userId: meron.id, eventId: byEvent("eskista-and-funk-night").id }, { userId: meron.id, eventId: byEvent("entoto-sunrise-run-10k").id }] });

  // Three people ask for refunds after the refund window closed on the live event.
  const lateShift = byEvent("abay-late-shift-live");
  const refundable = tickets.filter((t) => t.eventId === lateShift.id && t.seq === 1 && t.status === "VALID").slice(0, 3);
  for (const t of refundable) await db.refundRequest.create({ data: { orderId: t.orderId, reason: "Can't make it any more", createdAt: new Date(now.getTime() - (2 - refundable.indexOf(t) * 0.7) * DAY) } });

  await db.moderationLog.createMany({
    data: [
      { adminId: admin.id, eventId: byEvent("pottery-for-two").id, organizerId: birhan.id, action: "APPROVE", note: "", createdAt: new Date(now.getTime() - 12 * DAY) },
      { adminId: admin.id, eventId: cancelled.id, organizerId: birhan.id, action: "APPROVE", note: "", createdAt: new Date(now.getTime() - 20 * DAY) },
    ],
  });

  console.log("\nSeed complete.\n");
  console.log("Logins (password for every account: " + PASSWORD + ")");
  console.table([
    { role: "Admin", email: admin.email, name: admin.name },
    { role: "Organizer (verified)", email: dawit.email, name: "Dawit Mekonnen — Abay Sound Collective" },
    { role: "Organizer (verified)", email: hanna.email, name: "Hanna Girma — Zema Events" },
    { role: "Organizer (verified)", email: liya.email, name: "Liya Solomon — Skylight Jazz Club" },
    { role: "Organizer (unverified)", email: yonas.email, name: "Yonas Alemu — Selam Stride Club" },
    { role: "Organizer (unverified)", email: selamawit.email, name: "Selamawit Haile — Birhan Studio" },
    { role: "Attendee", email: meron.email, name: "Meron Tesfaye (has upcoming, past & refunded tickets)" },
    { role: "Attendee", email: abel.email, name: "Abel Tekle" },
    { role: "Attendee", email: hiwot.email, name: "Hiwot Alemayehu" },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
