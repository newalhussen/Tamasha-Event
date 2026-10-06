import { Router } from "express";
import * as admin from "../controllers/admin.controller";
import * as auth from "../controllers/auth.controller";
import * as events from "../controllers/events.controller";
import * as orders from "../controllers/orders.controller";
import * as org from "../controllers/organizer.controller";
import * as tickets from "../controllers/tickets.controller";
import { requireAuth, requireOrganizer } from "../middleware/auth";

export const api = Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/* ---- auth and profile ---- */
api.post("/auth/login", auth.login);
api.post("/auth/register", auth.register);
api.post("/auth/logout", auth.logout);
api.get("/auth/me", auth.current);
api.patch("/me", requireAuth(), auth.updateMe);

/* ---- public events (discovery, detail, small interactions) ---- */
api.get("/events", events.discover);
api.get("/events/:slug", events.detail);
api.get("/events/:id/calendar", events.calendar);
api.post("/events/:id/view", events.view);
api.post("/events/:id/save", requireAuth(), events.save);
api.delete("/events/:id/save", requireAuth(), events.unsave);
api.post("/events/:id/waitlist", events.waitlist);
api.post("/events/:id/report", events.report);

/* ---- checkout and orders (buyers) ---- */
api.post("/holds", orders.createHold);
api.get("/orders/:id/checkout", orders.checkout);
api.post("/orders/:id/pay", orders.pay);
api.post("/orders/:id/refund", requireAuth("ATTENDEE"), orders.refund);
api.get("/orders/:id", requireAuth("ATTENDEE"), orders.confirmation);

/* ---- tickets ---- */
api.get("/me/tickets", requireAuth("ATTENDEE", "ORGANIZER", "ADMIN"), tickets.mine);
api.get("/tickets/:code", requireAuth("ATTENDEE"), tickets.byCode);
api.patch("/tickets/:id", requireAuth("ATTENDEE"), tickets.patch);

/* ---- organizer ---- */
export const organizer = Router();
organizer.use(requireOrganizer);
organizer.get("/dashboard", org.dashboard);
organizer.get("/events", org.listEvents);
organizer.post("/events", org.createEvent);
organizer.get("/events/:id", org.eventDetail);
organizer.patch("/events/:id", org.updateEvent);
organizer.delete("/events/:id", org.deleteEvent);
organizer.get("/events/:id/overview", org.eventOverview);
organizer.get("/events/:id/analytics", org.eventAnalytics);
organizer.post("/events/:id/publish", org.publish);
organizer.post("/events/:id/unpublish", org.unpublish);
organizer.post("/events/:id/cancel", org.cancel);
organizer.post("/events/:id/tickets", org.addTicket);
organizer.patch("/events/:id/tickets/:typeId", org.updateTicket);
organizer.delete("/events/:id/tickets/:typeId", org.deleteTicket);
organizer.get("/events/:id/attendees", org.attendees);
organizer.get("/events/:id/attendees/export", org.exportAttendees);
organizer.post("/events/:id/message", org.message);
organizer.get("/events/:id/checkin", org.progress);
organizer.post("/events/:id/checkin", org.checkIn);
organizer.post("/events/:id/checkin/:ticketId", org.checkInTicket);
organizer.delete("/events/:id/checkin/:ticketId", org.undoCheckInTicket);
organizer.get("/orders", org.orders);
organizer.patch("/refunds/:id", org.decideRefund);
organizer.get("/payouts", org.payouts);
organizer.get("/profile", org.getProfile);
organizer.patch("/profile", org.updateProfile);
api.use("/organizer", organizer);

/* ---- admin ---- */
export const adminRouter = Router();
adminRouter.use(requireAuth("ADMIN"));
adminRouter.get("/counts", admin.counts);
adminRouter.get("/overview", admin.overview);
adminRouter.get("/events", admin.events);
adminRouter.get("/organizers", admin.organizers);
adminRouter.get("/users", admin.users);
adminRouter.get("/reports", admin.reports);
adminRouter.post("/events/:id/moderate", admin.moderate);
adminRouter.patch("/organizers/:id", admin.organizerAction);
adminRouter.patch("/users/:id", admin.userStatus);
adminRouter.patch("/reports/:id", admin.reportStatus);
api.use("/admin", adminRouter);
