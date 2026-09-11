"use client";

import { useState } from "react";

/** A ghost button that copies `text` and briefly confirms it did. */
export function CopyButton({
  text,
  label = "Copy link",
  style,
}: {
  text: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-ghost"
      style={{ width: "100%", ...style }}
      onClick={async () => {
        try {
          await navigator.clipboard?.writeText(text);
        } catch {
          // clipboard blocked (e.g. no permission) — nothing more we can do
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="glass" style={style}>
      <div className="glassin" style={{ padding: 20 }}>
        {children}
      </div>
    </div>
  );
}

/** The premium balance card — gunmetal + gold, floating on a neon shadow. */
export function WalletCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 24,
        padding: "28px 22px 22px",
        minHeight: 176,
        background:
          "linear-gradient(155deg, #3a3a42 0%, #232228 32%, #141317 68%, #0a0a0c 100%)",
        border: "1px solid rgba(224,184,110,0.35)",
        boxShadow:
          "0 30px 55px -18px rgba(224,184,110,0.35), 0 14px 30px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: -30,
          top: -30,
          opacity: 0.07,
          transform: "rotate(-10deg)",
          pointerEvents: "none",
        }}
      >
        <Logo size={160} />
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(115deg, transparent 40%, rgba(224,184,110,0.10) 50%, transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <img
      src="/brand/dynexa-logo.png"
      alt="DYNEXA"
      width={size}
      height={size}
      style={{ objectFit: "contain", borderRadius: 6 }}
    />
  );
}

export function TxLink({ hash }: { hash?: string }) {
  if (!hash || !hash.startsWith("0x")) return null;
  return (
    <a
      href={`https://testnet.arcscan.app/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="num"
      style={{ fontSize: 11 }}
    >
      {hash.slice(0, 10)}…{hash.slice(-6)} ↗
    </a>
  );
}

export type BrandName = "World" | "Privy" | "Circle" | "Arc" | "DYNEXA";

export const brandAccent: Record<BrandName, string> = {
  World: "#f5f3f7",
  Privy: "#d18cff",
  Circle: "#4ade80",
  Arc: "#22e5ff",
  DYNEXA: "#ff2fe0",
};

/** Simple, recognizable partner marks. Uses currentColor so the caller sets the tint. */
export function BrandMark({ name, size = 14 }: { name: BrandName; size?: number }) {
  if (name === "DYNEXA") return <Logo size={size} />;
  const paths: Record<Exclude<BrandName, "DYNEXA">, React.ReactNode> = {
    World: (
      <>
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M9.3 7.2V16.8M9.3 7.2H15M9.3 12H14M9.3 16.8H15"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    Privy: (
      <path
        d="M7 21V8.5a5.5 5.5 0 1 1 5.5 5.5H7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    ),
    Circle: (
      <>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="12" cy="12" r="3.4" fill="currentColor" />
      </>
    ),
    Arc: (
      <>
        <path d="M3 19a9 9 0 0 1 18 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="12" cy="8.5" r="2.6" fill="currentColor" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {paths[name as Exclude<BrandName, "DYNEXA">]}
    </svg>
  );
}

/** "via <partner>" chip, so it's clear which track does what. */
export function Partner({ name }: { name: BrandName }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10.5,
        fontWeight: 700,
        color: "var(--muted)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 999,
        padding: "3px 8px",
      }}
    >
      <span style={{ color: brandAccent[name], display: "inline-flex" }}>
        <BrandMark name={name} size={12} />
      </span>
      {name}
    </span>
  );
}

export function Amount({ value, unit = "USDC" }: { value: string | number; unit?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span className="num" style={{ fontSize: 34, fontWeight: 700, color: "var(--cyan)" }}>
        {value}
      </span>
      <span className="num" style={{ fontSize: 15, fontWeight: 600, color: "var(--muted)" }}>
        {unit}
      </span>
    </span>
  );
}

/** Friendly message for the customer, with the raw error tucked behind "See details". */
export function ErrorNote({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ color: "#ff8a8a", fontSize: 12.5 }}>
        Something didn't go through. Please try again in a moment.
      </p>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          fontSize: 11,
          textDecoration: "underline",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {open ? "Hide details" : "See details"}
      </button>
      {open && (
        <p className="num" style={{ color: "var(--muted)", fontSize: 11, marginTop: 4, wordBreak: "break-word" }}>
          {message}
        </p>
      )}
    </div>
  );
}
