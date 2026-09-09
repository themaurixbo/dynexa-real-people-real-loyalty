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
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="9" r="3.6" fill="currentColor" />
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
