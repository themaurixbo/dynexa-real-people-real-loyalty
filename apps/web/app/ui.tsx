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
