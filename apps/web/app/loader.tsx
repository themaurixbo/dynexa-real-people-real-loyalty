"use client";

import { useEffect, useState } from "react";
import { BrandMark, brandAccent, type BrandName } from "./ui";

export type TrackStep = { brand: BrandName; label: string };

/**
 * Shown while a multi-step operation runs. The backend does the steps in this
 * order; we advance the label on a timer and hold on the last one until the
 * caller unmounts the loader. `inline` renders inside a card instead of over
 * the screen.
 */
export function TrackLoader({
  steps,
  title,
  inline = false,
}: {
  steps: TrackStep[];
  title?: string;
  inline?: boolean;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (i >= steps.length - 1) return;
    const t = setTimeout(() => setI((n) => Math.min(n + 1, steps.length - 1)), 2100);
    return () => clearTimeout(t);
  }, [i, steps.length]);

  const step = steps[Math.min(i, steps.length - 1)];
  const accent = brandAccent[step.brand];

  const body = (
    <div
      className="glassin"
      style={{ padding: 28, textAlign: "center", ["--tl-accent" as string]: accent } as React.CSSProperties}
    >
      <div style={{ position: "relative", width: 74, height: 74, margin: "0 auto 18px" }}>
        <div className="tl-ring" />
        <div
          className="tl-badge"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accent,
          }}
        >
          <BrandMark name={step.brand} size={30} />
        </div>
      </div>

      {title && (
        <div className="label" style={{ marginBottom: 6 }}>
          {title}
        </div>
      )}

      <div key={i} className="tl-step" style={{ fontWeight: 700, fontSize: 14.5, minHeight: 40, lineHeight: 1.4 }}>
        {step.label}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>via {step.brand}</div>

      <div className="tl-dots" style={{ marginTop: 16 }}>
        {steps.map((_, n) => (
          <span key={n} className={`tl-dot ${n <= i ? "on" : ""}`} />
        ))}
      </div>
    </div>
  );

  if (inline) return <div className="glass">{body}</div>;

  return (
    <div className="tl-overlay">
      <div className="glass" style={{ width: "100%", maxWidth: 340 }}>
        {body}
      </div>
    </div>
  );
}
