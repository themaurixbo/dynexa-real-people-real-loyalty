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

/** "powered by <partner>" chip, so it's clear which track does what. */
export function Partner({ name }: { name: "World" | "Privy" | "Arc" }) {
  const mark = {
    World: (
      <svg width="12" height="12" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="9" r="3.4" fill="currentColor" />
      </svg>
    ),
    Privy: (
      <svg width="12" height="12" viewBox="0 0 24 24">
        <path d="M6 20V6a6 6 0 1 1 6 6H6" fill="none" stroke="currentColor" strokeWidth="2.4" />
      </svg>
    ),
    Arc: (
      <svg width="12" height="12" viewBox="0 0 24 24">
        <path d="M4 20a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="12" cy="9" r="2.4" fill="currentColor" />
      </svg>
    ),
  }[name];
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
      {mark} {name}
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
