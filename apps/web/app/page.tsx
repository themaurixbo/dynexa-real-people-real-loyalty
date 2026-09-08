"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Logo } from "./ui";
import { CustomerApp } from "./customer";
import { BusinessApp } from "./business";

export default function Home() {
  const { ready, authenticated, user, logout } = usePrivy();
  const [mode, setMode] = useState<"customer" | "business">("customer");

  return (
    <main
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: mode === "business" ? 1080 : 440,
        margin: "0 auto",
        padding: "20px 18px 48px",
        minHeight: "100dvh",
        transition: "max-width .2s",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={26} />
          <span className="num" style={{ fontWeight: 700, fontSize: 18, letterSpacing: 0.3 }}>
            DYNEXA
          </span>
        </div>
        <div className="mode-switch">
          <button
            className={`mode-tab ${mode === "customer" ? "active" : ""}`}
            onClick={() => setMode("customer")}
          >
            Customer
          </button>
          <button
            className={`mode-tab ${mode === "business" ? "active" : ""}`}
            onClick={() => setMode("business")}
          >
            Business
          </button>
        </div>
      </header>

      {ready && authenticated && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--muted)",
            marginBottom: 16,
          }}
        >
          <span>{user?.email?.address ?? user?.phone?.number ?? "signed in"}</span>
          <button className="mode-tab" onClick={logout}>
            Sign out
          </button>
        </div>
      )}

      {mode === "customer" ? <CustomerApp /> : <BusinessApp />}
    </main>
  );
}
