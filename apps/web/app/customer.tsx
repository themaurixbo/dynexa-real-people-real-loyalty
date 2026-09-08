"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { api, type Campaign, type ClaimResult } from "../lib/api";
import { usdcBalance } from "../lib/chain";
import { Amount, Card, Logo, TxLink } from "./ui";

export function CustomerApp() {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const wallet = useMemo(
    () => wallets.find((w) => w.walletClientType === "privy") ?? wallets[0],
    [wallets],
  );

  if (!ready) return <p style={{ color: "var(--muted)" }}>Loading…</p>;

  if (!authenticated) {
    return (
      <div style={{ textAlign: "center", paddingTop: 60 }}>
        <Logo size={72} />
        <h1 className="num" style={{ fontSize: 26, marginTop: 20, marginBottom: 10 }}>
          DYNEXA
        </h1>
        <p style={{ color: "var(--muted)", maxWidth: 280, margin: "0 auto 28px", lineHeight: 1.5 }}>
          Real rewards for real, human-verified people. No wallet setup, no seed phrase.
        </p>
        <button className="btn-primary" onClick={login}>
          Continue with email or phone
        </button>
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12 }}>
          Your wallet is created automatically and secured by Privy.
        </p>
      </div>
    );
  }

  const contact = user?.email?.address ?? user?.phone?.number ?? user?.id ?? "";
  return <Home wallet={wallet?.address} contact={contact} />;
}

function Home({ wallet, contact }: { wallet?: string; contact: string }) {
  const [balance, setBalance] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [claiming, setClaiming] = useState<Campaign | null>(null);

  useEffect(() => {
    if (wallet) usdcBalance(wallet).then(setBalance);
    api.campaigns().then((c) => setCampaigns(c.filter((x) => x.status === "active")));
  }, [wallet]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <span className="pill pill-verified">✓ Human Verified</span>

      <Card>
        <div className="label">Available balance</div>
        <div style={{ marginTop: 8 }}>
          <Amount value={balance ?? "—"} />
        </div>
        <p className="num" style={{ fontSize: 11, color: "var(--muted)", marginTop: 12, wordBreak: "break-all" }}>
          {wallet ?? "creating wallet…"}
        </p>
      </Card>

      <div className="label">Available rewards</div>
      {campaigns.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>No active campaigns right now.</p>
      )}
      {campaigns.map((c) => (
        <Card key={c.id}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {c.rewardMode === "usdc"
              ? `${Number(c.rewardPerUserUsdc)} USDC`
              : "A branded gift"}{" "}
            · up to {c.maxUsesPerHuman} per person
          </div>
          <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>{c.qualifyCondition}</p>
          <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => setClaiming(c)}>
            Claim reward
          </button>
        </Card>
      ))}

      {claiming && (
        <ClaimModal
          campaign={claiming}
          contact={contact}
          wallet={wallet}
          onClose={() => setClaiming(null)}
        />
      )}
    </div>
  );
}

function ClaimModal({
  campaign,
  contact,
  wallet,
  onClose,
}: {
  campaign: Campaign;
  contact: string;
  wallet?: string;
  onClose: () => void;
}) {
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.claim({
        campaignId: campaign.id,
        contact,
        customerAddress: wallet,
        evidenceText: evidence || "receipt photo",
        receiptRef: `${contact}-${Date.now()}`,
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        zIndex: 50,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400 }}>
        <Card>
          {!result ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{campaign.name}</div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                {campaign.qualifyCondition}
              </p>
              <div className="label" style={{ marginBottom: 6 }}>
                Describe your proof of purchase
              </div>
              <textarea
                className="field"
                rows={3}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="e.g. receipt from Vacafría for a pistachio cone"
              />
              {error && (
                <p style={{ color: "#ff8a8a", fontSize: 12, marginTop: 8 }}>{error}</p>
              )}
              <button className="btn-primary" style={{ marginTop: 14 }} disabled={busy} onClick={submit}>
                {busy ? "The agent is checking…" : "Submit claim"}
              </button>
            </>
          ) : (
            <ResultView result={result} onClose={onClose} />
          )}
        </Card>
      </div>
    </div>
  );
}

function ResultView({ result, onClose }: { result: ClaimResult; onClose: () => void }) {
  const good = result.status === "paid";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 32 }}>{good ? "🎉" : result.status === "rejected" ? "⛔" : "⏳"}</div>
      <div style={{ fontWeight: 700, fontSize: 16, margin: "6px 0" }}>
        {good
          ? result.amountUsdc
            ? `You received ${result.amountUsdc} USDC`
            : "Your gift is on the way"
          : result.status === "rejected"
            ? "Reward blocked"
            : "Waiting for business approval"}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{result.reason}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", margin: "12px 0" }}>
        {result.reasonCodes.map((c) => (
          <span
            key={c}
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 999,
              padding: "4px 9px",
            }}
          >
            {c.replace(/_/g, " ").toLowerCase()}
          </span>
        ))}
      </div>
      <TxLink hash={result.txHash} />
      <button className="btn-ghost" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>
        Done
      </button>
    </div>
  );
}
