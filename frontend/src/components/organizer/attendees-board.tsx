"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";
import { n, pct, timeLabel } from "@/lib/format";

export type Row = {
  id: string;
  name: string;
  namedByBuyer: boolean;
  orderCode: string;
  seq: number;
  ofCount: number;
  ticketType: string;
  code: string;
  status: "VALID" | "CHECKED_IN" | "REFUNDED";
  checkedInAt: string | null;
  gate: string | null;
  note: string;
};
export type Progress = {
  total: number;
  checked: number;
  byType: { id: string; name: string; checked: number; total: number }[];
  last: { at: string; gate: string | null } | null;
  gates: { gate: string; by: string; scans: number }[];
};
export type Data = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; checkedIn: number; notYet: number; refunded: number };
  progress: Progress;
};

type Status = "all" | "in" | "not";

export function AttendeesBoard({ eventId, initial, types }: { eventId: string; initial: Data; types: { id: string; name: string }[] }) {
  const toast = useToast();
  const [data, setData] = useState<Data>(initial);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [typeId, setTypeId] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const first = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const sp = new URLSearchParams({ status, page: String(page) });
        if (q.trim()) sp.set("q", q.trim());
        if (typeId) sp.set("type", typeId);
        setData(await api<Data>(`/api/organizer/events/${eventId}/attendees?${sp}`));
      } catch (e) {
        if (!silent) toast(e instanceof ClientError ? e.message : "Couldn't load attendees", "error");
      } finally {
        setLoading(false);
      }
    },
    [eventId, q, status, typeId, page, toast],
  );

  // Refetch when filters change (debounced for typing); keep the door numbers fresh while scanners are working.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);
  useEffect(() => {
    const id = setInterval(() => load(true), 10_000);
    return () => clearInterval(id);
  }, [load]);

  async function act(row: Row, undo: boolean) {
    setBusyId(row.id);
    try {
      if (undo) await api(`/api/organizer/events/${eventId}/checkin/${row.id}`, { method: "DELETE", body: {} });
      else {
        const res = await api<{ result: { kind: string } }>(`/api/organizer/events/${eventId}/checkin/${row.id}`, { body: {} });
        if (res.result.kind !== "OK") toast(res.result.kind === "ALREADY" ? "Already checked in" : "That ticket can't be checked in", "error");
      }
      await load(true);
    } catch (e) {
      toast(e instanceof ClientError ? e.message : "Couldn't update that", "error");
    } finally {
      setBusyId(null);
    }
  }

  const p = data.progress;
  const arrived = pct(p.checked, p.total);
  const lastScan = p.last ? `last scan ${timeLabel(p.last.at)}${p.last.gate ? ` at ${p.last.gate}` : ""}` : "no scans yet";
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <section aria-label="Live check-in" className="flex flex-wrap gap-x-14 gap-y-7 rounded-[20px] bg-night px-8 py-[26px] text-white max-sm:px-5">
        <div className="flex min-w-[260px] flex-[1_1_320px] flex-col gap-2.5">
          <div className="mono text-xs tracking-[0.06em] text-sun">CHECK-IN · LIVE</div>
          <div>
            <span className="font-display text-[52px] font-bold leading-none tracking-[-0.04em]">{n(p.checked)}</span> <span className="text-lg text-soft">of {n(p.total)} through the door</span>
          </div>
          <div role="img" aria-label={`${p.checked} of ${p.total} attendees checked in, ${arrived} percent`} className="meter-dark">
            <span style={{ width: `${arrived}%` }} />
          </div>
          <div className="text-sm text-soft">
            {arrived}% arrived · {n(p.total - p.checked)} still to come · {lastScan}
          </div>
        </div>
        <div className="grid min-w-[260px] flex-[1.3_1_420px] content-center gap-x-8 gap-y-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))" }}>
          {p.byType.map((t) => (
            <div key={t.id} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-2">
                <span>{t.name}</span>
                <span className="font-bold">
                  {n(t.checked)} / {n(t.total)}
                </span>
              </div>
              <div className="h-1.5 rounded-[3px] bg-night2">
                <div className="h-full rounded-[3px] bg-white" style={{ width: `${pct(t.checked, t.total)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-[0_1_200px] flex-col justify-center gap-1.5 text-sm text-soft">
          <div className="text-[15px] font-bold text-white">{p.gates.length === 0 ? "No scanners yet" : `${p.gates.length} ${p.gates.length === 1 ? "scanner" : "scanners"} active`}</div>
          {p.gates.map((g) => (
            <div key={g.gate + g.by}>
              {g.gate} · {g.by.split(" ")[0]} · {n(g.scans)} scans
            </div>
          ))}
          <Link href={`/organizer/events/${eventId}/scan`} className="on-dark pt-1 font-semibold text-white">
            Open the door scanner
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex min-w-[240px] flex-[1_1_320px] items-center">
            <Icon name="search" size={18} className="absolute left-3.5 text-muted" />
            <label htmlFor="aq" className="sr-only">
              Search attendees
            </label>
            <input
              id="aq"
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email, phone or ticket code"
              className="h-12 w-full rounded-xl border border-field bg-white pl-[42px] pr-3.5 font-[inherit]"
            />
          </div>
          {(
            [
              ["all", `All ${n(data.counts.all - data.counts.refunded)}`],
              ["in", `Checked in ${n(data.counts.checkedIn)}`],
              ["not", `Not yet ${n(data.counts.notYet)}`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className="pill"
              aria-pressed={status === k}
              onClick={() => {
                setStatus(k);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
          <label htmlFor="ticket-type" className="sr-only">
            Ticket type
          </label>
          <select
            id="ticket-type"
            className="select-btn"
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All ticket types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <button type="button" className="btn" onClick={() => setMsgOpen(true)}>
            Message attendees
          </button>
          <a href={`/api/organizer/events/${eventId}/attendees/export`} className="btn">
            Export CSV
          </a>
        </div>

        <div className={`table-card transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th scope="col">Attendee</th>
                <th scope="col">Ticket</th>
                <th scope="col">Code</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => {
                const refunded = r.status === "REFUNDED";
                return (
                  <tr key={r.id} className={refunded ? "text-muted" : ""}>
                    <td>
                      <div className={`font-bold ${refunded ? "line-through" : ""}`}>{r.name}</div>
                      <div className="text-sm text-muted">
                        Order #{r.orderCode} · {r.seq} of {r.ofCount}
                        {r.note ? ` · ${r.note}` : ""}
                      </div>
                    </td>
                    <td>{r.ticketType}</td>
                    <td className={`mono text-[13px] ${refunded ? "line-through" : ""}`}>{r.code}</td>
                    <td>
                      {r.status === "CHECKED_IN" ? (
                        <>
                          <div className="flex items-center gap-2 font-bold text-primary-dark">
                            <Icon name="check" stroke={3} />
                            Checked in
                          </div>
                          <div className="text-[13px] text-muted">
                            {r.checkedInAt ? timeLabel(r.checkedInAt) : ""}
                            {r.gate ? ` · ${r.gate}` : ""}
                          </div>
                        </>
                      ) : refunded ? (
                        <span className="badge badge-danger">Refunded</span>
                      ) : (
                        <span className="text-muted">Not arrived</span>
                      )}
                    </td>
                    <td className="text-right">
                      {refunded ? (
                        <span className="text-sm">Ticket no longer valid</span>
                      ) : r.status === "CHECKED_IN" ? (
                        <button type="button" className="btn" disabled={busyId === r.id} onClick={() => act(r, true)}>
                          {busyId === r.id && <Spinner />}Undo
                        </button>
                      ) : (
                        <button type="button" className="btn btn-dark" disabled={busyId === r.id} onClick={() => act(r, false)}>
                          {busyId === r.id && <Spinner />}Check in
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    {q || typeId || status !== "all" ? "No attendees match those filters." : "No tickets sold yet. Attendees appear here as orders come in."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
          <span>
            Showing {data.items.length} of {n(data.total)} attendees
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>
              Previous
            </button>
            <button type="button" className="btn" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>
              Next
            </button>
          </div>
        </div>
      </section>

      <MessageDialog eventId={eventId} open={msgOpen} onClose={() => setMsgOpen(false)} />
    </>
  );
}

function MessageDialog({ eventId, open, onClose }: { eventId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const res = await api<{ recipients: number }>(`/api/organizer/events/${eventId}/message`, { body: { subject, body } });
      toast(`Message sent to ${res.recipients} ${res.recipients === 1 ? "buyer" : "buyers"}`);
      setSubject("");
      setBody("");
      onClose();
    } catch (err) {
      if (err instanceof ClientError) {
        setErrors(err.fields);
        if (!Object.keys(err.fields).length) setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Message attendees">
      <form onSubmit={send} noValidate className="flex flex-col gap-4">
        <p className="m-0 text-muted">Sent by email to everyone who holds a valid ticket.</p>
        <Field label="Subject" error={errors.subject}>
          {(p) => <input {...p} className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />}
        </Field>
        <Field label="Message" error={errors.body}>
          {(p) => <textarea {...p} rows={5} className="input" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />}
        </Field>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-dark" disabled={busy}>
            {busy && <Spinner />}Send
          </button>
        </div>
      </form>
    </Dialog>
  );
}
