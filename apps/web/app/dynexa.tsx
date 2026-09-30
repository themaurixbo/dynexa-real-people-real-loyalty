"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { api } from "../lib/api";
import { Card, Logo } from "./ui";
import { TrackLoader } from "./loader";

/** Accepts either the full share URL (?dynexa-charge=CODE) or the raw code. */
function extractChargeCode(raw: string): string | null {
  try {
    const url = new URL(raw);
    const code = url.searchParams.get("dynexa-charge");
    if (code) return code.toUpperCase();
  } catch {
    // not a URL — fall through and try it as a bare code
  }
  const trimmed = raw.trim().toUpperCase();
  return /^POS-[A-Z0-9]+$/.test(trimmed) ? trimmed : null;
}

/** Contactless-pay glyph, matches the app's line-icon set. */
export function PayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2.5" y="5" width="15" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 8.7H17.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.3 11.7H8.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

type Phase = "scan" | "confirm" | "paying" | "done" | "error";
type ChargeInfo = { code: string; amountDynexa: string; businessName: string };

/**
 * PAGAR flow: scan the POS's "Cobrar" QR (or land here via ?dynexa-charge=CODE),
 * confirm, and the amount moves off the customer's DYNEXA balance — no chain
 * call, it's a closed-loop points spend (see apps/api/src/routes/dynexa.ts).
 */
export function DynexaPayModal({
  wallet,
  contact,
  initialCode,
  onClose,
  onPaid,
}: {
  wallet: string;
  contact: string;
  initialCode?: string | null;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(initialCode ? "confirm" : "scan");
  const [charge, setCharge] = useState<ChargeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function loadCharge(code: string) {
    try {
      const r = await api.getDynexaCharge(code);
      if (r.status !== "pending") {
        setError("This charge was already paid or canceled.");
        setPhase("error");
        return;
      }
      setCharge(r);
      setPhase("confirm");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  useEffect(() => {
    if (initialCode) loadCharge(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  // Camera scan loop — decodes QR frames client-side, no upload.
  useEffect(() => {
    if (phase !== "scan") return;
    let raf = 0;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const tick = () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (v && ctx && v.videoWidth > 0) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(img.data, img.width, img.height);
            const code = result?.data ? extractChargeCode(result.data) : null;
            if (code) {
              cancelled = true;
              stream.getTracks().forEach((t) => t.stop());
              loadCharge(code);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setError("Couldn't access the camera. Check permissions and try again.");
        setPhase("error");
      }
    }
    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function confirmPay() {
    if (!charge) return;
    setPhase("paying");
    try {
      const r = await api.payDynexaCharge(charge.code, wallet, contact);
      setPaidAmount(r.amountDynexa);
      setPhase("done");
      onPaid();
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 60,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380 }}>
        <Card>
          {phase === "scan" && (
            <>
              <div className="label" style={{ marginBottom: 8, textAlign: "center" }}>
                Scan the merchant&apos;s charge QR
              </div>
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "1" }}
              />
              {error && <ErrorLine text={error} />}
              <button className="btn-ghost" style={{ width: "100%", marginTop: 12 }} onClick={onClose}>
                Cancel
              </button>
            </>
          )}

          {phase === "paying" && (
            <TrackLoader
              title="Transferring your DYNEXA"
              steps={[{ brand: "DYNEXA", label: "Moving your DYNEXA points" }]}
            />
          )}

          {phase === "confirm" && charge && (
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
                <Logo size={30} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>
                Pay {Number(charge.amountDynexa)} DYNEXA?
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 16px" }}>
                to {charge.businessName}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>
                  No
                </button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={confirmPay}>
                  Yes, pay
                </button>
              </div>
            </div>
          )}

          {phase === "done" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32 }}>✅</div>
              <div style={{ fontWeight: 700, margin: "6px 0" }}>
                Paid successfully — {Number(paidAmount)} DYNEXA
              </div>
              <button className="btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={onClose}>
                Ver saldo
              </button>
            </div>
          )}

          {phase === "error" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28 }}>⛔</div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 14px" }}>{error}</p>
              <button className="btn-ghost" style={{ width: "100%" }} onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return <p style={{ color: "#ff8a8a", fontSize: 12, marginTop: 8, textAlign: "center" }}>{text}</p>;
}
