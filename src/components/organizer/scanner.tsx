"use client";

import Link from "next/link";
import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/form";
import { api, ClientError } from "@/lib/client";
import { GATES } from "@/lib/enums";
import { timeLabel } from "@/lib/format";

type ScanTicket = { id: string; code: string; holder: string; ticketType: string; seq: number; ofCount: number; orderCode: string; ageLimit: number };
type Result =
  | { kind: "OK"; ticket: ScanTicket; at: string }
  | { kind: "ALREADY"; ticket: ScanTicket; at: string; gate: string | null; by: string | null }
  | { kind: "WRONG_EVENT"; other: { title: string; when: string } }
  | { kind: "INVALID"; ticket: ScanTicket; reason: string }
  | { kind: "NOT_FOUND" };
type Progress = { total: number; checked: number };
type Hit = { id: string; name: string; ticketType: string; code: string; status: string; orderCode: string; seq: number; ofCount: number };

export function Scanner({ eventId, eventTitle, initial }: { eventId: string; eventTitle: string; initial: Progress }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pausedRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busyRef = useRef(false);

  const [gate, setGate] = useState<string>("Gate A");
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const [progress, setProgress] = useState(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off" | "denied">("starting");
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const [manual, setManual] = useState("");
  const [checking, setChecking] = useState(false);
  const [finder, setFinder] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const g = localStorage.getItem("tamasha:gate");
      if (g) setGate(g);
    } catch {
      /* ignore */
    }
  }, []);

  const submit = useCallback(
    async (code: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setChecking(true);
      setError(null);
      try {
        const res = await api<{ result: Result; progress: Progress }>(`/api/organizer/events/${eventId}/checkin`, { body: { code, gate: gateRef.current } });
        pausedRef.current = true;
        setResult(res.result);
        setProgress(res.progress);
        if (res.result.kind === "OK") {
          if (navigator.vibrate) navigator.vibrate(60);
          setTimeout(() => {
            if (pausedRef.current && lastRef.current.code === code) {
              pausedRef.current = false;
              setResult(null);
            }
          }, 2800);
        } else if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
      } catch (e) {
        setError(e instanceof ClientError ? e.message : "Couldn't check that ticket. Try again.");
        pausedRef.current = false;
      } finally {
        busyRef.current = false;
        setChecking(false);
      }
    },
    [eventId],
  );

  // Camera + decode loop
  useEffect(() => {
    let raf = 0;
    let stopped = false;
    let lastTick = 0;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("off");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setCamera("on");
        const caps = (stream.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorch({ supported: !!caps.torch, on: false });
        loop();
      } catch (e) {
        setCamera((e as DOMException)?.name === "NotAllowedError" ? "denied" : "off");
      }
    }

    function loop() {
      raf = requestAnimationFrame((t) => {
        if (stopped) return;
        if (t - lastTick > 180 && !pausedRef.current && !busyRef.current) {
          lastTick = t;
          const v = videoRef.current;
          const c = canvasRef.current;
          if (v && c && v.readyState >= 2 && v.videoWidth) {
            const w = 480;
            const h = Math.round((v.videoHeight / v.videoWidth) * w);
            c.width = w;
            c.height = h;
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0, w, h);
            const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            const text = code?.data?.trim();
            if (text && /^TMS-/i.test(text)) {
              const now = Date.now();
              if (!(lastRef.current.code === text && now - lastRef.current.at < 3000)) {
                lastRef.current = { code: text, at: now };
                submit(text);
              }
            }
          }
        }
        loop();
      });
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [submit]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ supported: true, on });
    } catch {
      setTorch({ supported: false, on: false });
    }
  }

  function next() {
    pausedRef.current = false;
    lastRef.current = { code: "", at: 0 };
    setResult(null);
    setError(null);
  }

  async function undo() {
    if (!result || !("ticket" in result)) return;
    try {
      const res = await api<{ progress: Progress }>(`/api/organizer/events/${eventId}/checkin/${result.ticket.id}`, { method: "DELETE", body: {} });
      setProgress(res.progress);
      next();
    } catch (e) {
      setError(e instanceof ClientError ? e.message : "Couldn't undo that.");
    }
  }

  // "Find by name" search
  useEffect(() => {
    if (!finder) return;
    const t = setTimeout(async () => {
      try {
        const sp = new URLSearchParams({ status: "all" });
        if (q.trim()) sp.set("q", q.trim());
        const res = await api<{ items: Hit[] }>(`/api/organizer/events/${eventId}/attendees?${sp}`);
        setHits(res.items);
      } catch {
        setHits([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, finder, eventId]);

  async function checkHit(h: Hit) {
    pausedRef.current = true;
    await submit(h.code);
    setFinder(false);
  }

  const ok = result?.kind === "OK";
  const banner =
    result?.kind === "OK"
      ? { bg: "bg-primary", icon: "check" as const, title: "Valid. Let them in.", sub: `Checked in at ${timeLabel(result.at)}` }
      : result?.kind === "ALREADY"
        ? { bg: "bg-danger", icon: "x" as const, title: "Already scanned. Stop.", sub: `${timeLabel(result.at)}${result.gate ? ` at ${result.gate}` : ""}${result.by ? `, by ${result.by.split(" ")[0]}` : ""}` }
        : result?.kind === "WRONG_EVENT"
          ? { bg: "bg-night", icon: null, title: "Not for this event", sub: `This ticket is for ${result.other.title}, ${result.other.when}` }
          : result?.kind === "INVALID"
            ? { bg: "bg-danger", icon: "x" as const, title: "Not valid", sub: result.reason }
            : result?.kind === "NOT_FOUND"
              ? { bg: "bg-night", icon: null, title: "Ticket not found", sub: "Check the code and try again" }
              : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-night text-white">
      <div className="flex items-center gap-3 px-5 pb-3.5 pt-8">
        <Link href={`/organizer/events/${eventId}/attendees`} aria-label="Close scanner" className="on-dark flex h-11 w-11 flex-none items-center justify-center rounded-full bg-night2 text-white">
          <Icon name="x" size={18} stroke={2.4} />
        </Link>
        <div className="min-w-0 flex-1">
          <label htmlFor="gate" className="sr-only">
            Gate
          </label>
          <select
            id="gate"
            value={gate}
            onChange={(e) => {
              setGate(e.target.value);
              try {
                localStorage.setItem("tamasha:gate", e.target.value);
              } catch {
                /* ignore */
              }
            }}
            className="on-dark w-full appearance-none border-0 bg-transparent font-bold text-white"
          >
            {GATES.map((g) => (
              <option key={g} value={g} className="text-ink">
                {g}
              </option>
            ))}
          </select>
          <div className="truncate text-[13px] text-soft2">{eventTitle}</div>
        </div>
        <div className="mono rounded-[10px] bg-night2 px-3 py-2 text-sm">
          {progress.checked} / {progress.total}
        </div>
      </div>

      <div className="relative mx-5 h-[300px] overflow-hidden rounded-3xl bg-night2">
        <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${camera === "on" ? "" : "hidden"}`} />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute left-1/2 top-1/2 h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
          <i className="absolute left-0 top-0 h-9 w-9 rounded-tl-xl border-l-4 border-t-4 border-white" />
          <i className="absolute right-0 top-0 h-9 w-9 rounded-tr-xl border-r-4 border-t-4 border-white" />
          <i className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-xl border-b-4 border-l-4 border-white" />
          <i className="absolute bottom-0 right-0 h-9 w-9 rounded-br-xl border-b-4 border-r-4 border-white" />
        </div>
        {camera !== "on" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center text-sm text-soft3">
            {camera === "starting" ? <Spinner size={22} /> : <Icon name="scan" size={28} />}
            <div>
              {camera === "starting"
                ? "Starting camera…"
                : camera === "denied"
                  ? "Camera access is blocked. Allow it in your browser settings, or type the ticket code below."
                  : "No camera available here. Type the ticket code below, or use the attendee list."}
            </div>
          </div>
        )}
        <div className="mono absolute left-3.5 top-3.5 text-xs text-soft2">{camera === "on" ? "Camera view" : ""}</div>
        {torch.supported && (
          <button type="button" aria-label={torch.on ? "Turn off torch" : "Turn on torch"} aria-pressed={torch.on} onClick={toggleTorch} className="on-dark absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full border-0 bg-night text-white">
            <Icon name="bolt" size={20} />
          </button>
        )}
        <div className="absolute bottom-3 left-3 rounded-[10px] bg-night px-3 py-2 text-[13px] text-soft3">Scanning as {gate}</div>
        {checking && (
          <div className="absolute inset-0 flex items-center justify-center bg-night/50">
            <Spinner size={28} />
          </div>
        )}
      </div>

      <div role="status" aria-live="assertive" className="mt-5 flex flex-1 flex-col gap-4 rounded-t-[28px] bg-white px-5 pb-5 pt-[22px] text-ink">
        {banner ? (
          <>
            <div className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-white ${banner.bg}`}>
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white">
                {banner.icon ? <Icon name={banner.icon} size={24} stroke={3.2} className={banner.bg === "bg-primary" ? "text-primary" : "text-danger"} /> : <span className="text-[22px] font-extrabold text-ink">?</span>}
              </span>
              <div>
                <div className="font-display text-2xl font-bold leading-[1.1] tracking-[-0.02em]">{banner.title}</div>
                <div className="text-sm opacity-85">{banner.sub}</div>
              </div>
            </div>
            {result && "ticket" in result && (
              <div>
                <div className="font-display text-[30px] font-bold leading-[1.1] tracking-[-0.03em]">{result.ticket.holder}</div>
                <div className="mt-1 text-[17px] font-semibold">{result.ticket.ticketType}</div>
                <div className="mt-0.5 text-muted">
                  Ticket {result.ticket.seq} of {result.ticket.ofCount} · Order #{result.ticket.orderCode}
                </div>
              </div>
            )}
            {ok && result.kind === "OK" && result.ticket.ageLimit > 0 && (
              <div className="flex items-center gap-2.5 rounded-xl bg-warn-bg px-3.5 py-3 font-semibold text-[#3D2F00]">
                <Icon name="id" size={20} />
                {result.ticket.ageLimit}+ event. Check ID.
              </div>
            )}
            <div className="flex-1" />
            <button type="button" onClick={next} className="h-[58px] rounded-2xl border-0 bg-night text-[17px] font-bold text-white">
              Scan next ticket
            </button>
            <div className="flex justify-between gap-3">
              {result && "ticket" in result && result.kind === "OK" ? (
                <button type="button" onClick={undo} className="btn-link btn !text-danger">
                  Undo check-in
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={() => setFinder(true)} className="btn-link btn">
                Find by name instead
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <div className="font-display text-2xl font-bold tracking-[-0.02em]">Ready to scan</div>
              <div className="text-muted">Hold a ticket's QR code inside the frame. It checks in automatically.</div>
            </div>
            {error && (
              <div role="alert" className="rounded-xl border-2 border-danger px-3.5 py-2.5 font-semibold text-danger">
                {error}
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (manual.trim()) submit(manual.trim()).then(() => setManual(""));
              }}
            >
              <label htmlFor="manual" className="sr-only">
                Ticket code
              </label>
              <input id="manual" value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} placeholder="TMS-XXXX-XXXX" autoCapitalize="characters" autoCorrect="off" className="input mono !h-12 flex-1" />
              <button type="submit" className="btn btn-dark btn-md" disabled={!manual.trim() || checking}>
                Check in
              </button>
            </form>
            <div className="flex-1" />
            <button type="button" onClick={() => setFinder(true)} className="btn-link btn self-center">
              Find by name instead
            </button>
          </>
        )}
      </div>

      {finder && (
        <div className="fixed inset-0 z-50 flex items-end bg-night/70" role="dialog" aria-modal="true" aria-label="Find an attendee">
          <div className="mx-auto flex max-h-[85vh] w-full max-w-[430px] flex-col gap-3 rounded-t-[28px] bg-white px-5 pb-5 pt-5 text-ink">
            <div className="flex items-center justify-between">
              <h2 className="h2">Find an attendee</h2>
              <button type="button" onClick={() => setFinder(false)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-neutral">
                <Icon name="x" size={18} stroke={2.4} />
              </button>
            </div>
            <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone or code" className="input" aria-label="Search attendees" />
            <ul className="m-0 flex list-none flex-col overflow-y-auto p-0">
              {hits.map((h) => (
                <li key={h.id} className="flex items-center gap-3 border-t border-line py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{h.name}</div>
                    <div className="truncate text-sm text-muted">
                      {h.ticketType} · #{h.orderCode} · {h.seq} of {h.ofCount}
                    </div>
                  </div>
                  {h.status === "CHECKED_IN" ? (
                    <span className="badge badge-tint">Checked in</span>
                  ) : h.status === "REFUNDED" ? (
                    <span className="badge badge-danger">Refunded</span>
                  ) : (
                    <button type="button" className="btn btn-dark" onClick={() => checkHit(h)}>
                      Check in
                    </button>
                  )}
                </li>
              ))}
              {hits.length === 0 && <li className="py-6 text-center text-muted">No matches.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
