"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { api, type Campaign, type ClaimResult } from "../lib/api";
import { usdcBalance } from "../lib/chain";
import { Amount, Card, Logo, Partner, TxLink } from "./ui";
import { TrackLoader } from "./loader";
import { WorldVerify, useWorldStatus } from "./world";

type Gift = { id: string; tokenId: number; code: string; status: string; campaignName: string };

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
      <div style={{ textAlign: "center", padding: "48px 4px 0" }}>
        <Logo size={72} />
        <h1 className="num" style={{ fontSize: 26, marginTop: 20, marginBottom: 10 }}>
          DYNEXA
        </h1>
        <p style={{ color: "var(--muted)", maxWidth: 300, margin: "0 auto 28px", lineHeight: 1.5 }}>
          Real rewards for real, human-verified people. No wallet setup, no seed phrase.
        </p>
        <button className="btn-primary" onClick={login}>
          Continue with email or phone
        </button>
        <p
          style={{
            color: "var(--muted)",
            fontSize: 12,
            marginTop: 12,
            display: "flex",
            gap: 6,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          Your wallet is created automatically <Partner name="Privy" />
        </p>
      </div>
    );
  }

  const contact = user?.email?.address ?? user?.phone?.number ?? user?.id ?? "";

  if (!wallet?.address) {
    return (
      <TrackLoader
        inline
        title="Almost there"
        steps={[
          { brand: "Privy", label: "Creating your wallet — no seed phrase" },
          { brand: "Arc", label: "Connecting it to Arc" },
        ]}
      />
    );
  }

  return <Home wallet={wallet.address} contact={contact} />;
}

function Home({ wallet, contact }: { wallet?: string; contact: string }) {
  const [tab, setTab] = useState<"home" | "wallet" | "gifts" | "profile">("home");
  const { verified, setVerified } = useWorldStatus(wallet);
  const [balance, setBalance] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [claiming, setClaiming] = useState<Campaign | null>(null);

  const load = useCallback(() => {
    if (!wallet) return;
    usdcBalance(wallet).then(setBalance);
    api.gifts(wallet).then(setGifts).catch(() => {});
    api
      .campaigns()
      .then((c) =>
        setCampaigns(c.filter((x) => x.status === "active" && x.name !== "DYNEXA Welcome")),
      )
      .catch(() => {});
  }, [wallet]);

  useEffect(() => {
    load();
    if (wallet && contact) api.welcome(contact, wallet).then(load).catch(() => {});
  }, [wallet, contact, load]);

  return (
    <div style={{ paddingBottom: 88 }}>
      {(tab === "home" || tab === "wallet") && (
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {verified ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pill pill-verified">✓ Human Verified</span>
              <Partner name="World" />
            </div>
          ) : wallet ? (
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>One quick check</div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                Before your first reward, confirm you are a real person. Takes a few
                seconds, no personal data is stored.
              </p>
              <WorldVerify contact={contact} wallet={wallet} onVerified={() => setVerified(true)} />
            </Card>
          ) : null}

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="label">Available balance</div>
              <Partner name="Privy" />
            </div>
            <div style={{ marginTop: 8 }}>
              <Amount value={balance ?? "—"} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <span
                className="num"
                style={{ fontSize: 11, color: "var(--muted)", wordBreak: "break-all" }}
              >
                {wallet ? `${wallet.slice(0, 10)}…${wallet.slice(-6)}` : "creating wallet…"}
              </span>
              <Partner name="Arc" />
            </div>
          </Card>
        </section>
      )}

      {(tab === "home" || tab === "gifts") && (
        <section style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          <div className="label">Your gifts</div>
          {gifts.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No gifts yet.</p>
          )}
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
            }}
          >
            {gifts.map((g) => (
              <div className="glass" key={g.id} style={{ opacity: g.status === "redeemed" ? 0.45 : 1 }}>
                <div className="glassin" style={{ padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 22 }}>🎁</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4 }}>
                    {g.campaignName}
                  </div>
                  <div className="num" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                    #{g.tokenId} · {g.status}
                  </div>
                  {g.status !== "redeemed" && (
                    <div
                      className="num"
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        letterSpacing: 0.5,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 8,
                        padding: "5px 4px",
                      }}
                    >
                      {g.code}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "home" && (
        <section style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          <div className="label">Available rewards</div>
          {campaigns.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No active campaigns right now.</p>
          )}
          {campaigns.map((c) => (
            <Card key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                <Partner name={c.rewardMode === "usdc" ? "Arc" : "Arc"} />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {c.rewardMode === "usdc" ? `${Number(c.rewardPerUserUsdc)} USDC` : "A branded gift"} ·
                up to {c.maxUsesPerHuman} per person
              </div>
              <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>{c.qualifyCondition}</p>
              <button
                className="btn-primary"
                style={{ marginTop: 14 }}
                onClick={() => setClaiming(c)}
              >
                Claim reward
              </button>
            </Card>
          ))}
        </section>
      )}

      {tab === "profile" && (
        <Card style={{ marginTop: 4 }}>
          <div className="label">Account</div>
          <p style={{ marginTop: 6, fontSize: 14 }}>{contact}</p>
          <p className="num" style={{ fontSize: 11, color: "var(--muted)", wordBreak: "break-all", marginTop: 6 }}>
            {wallet}
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <Partner name="Privy" />
            <Partner name="World" />
            <Partner name="Arc" />
          </div>
        </Card>
      )}

      {claiming && (
        <ClaimModal
          campaign={claiming}
          contact={contact}
          wallet={wallet}
          onClose={() => {
            setClaiming(null);
            load();
          }}
        />
      )}

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

function BottomNav({
  tab,
  setTab,
}: {
  tab: string;
  setTab: (t: "home" | "wallet" | "gifts" | "profile") => void;
}) {
  const items = [
    { id: "home", label: "Home", icon: "M3 9L10 3L17 9V16.5C17 17 16.5 17.5 16 17.5H4C3.5 17.5 3 17 3 16.5Z" },
    { id: "wallet", label: "Wallet", icon: "M2.5 6H17.5V15A1.5 1.5 0 0 1 16 16.5H4A1.5 1.5 0 0 1 2.5 15Z" },
    { id: "gifts", label: "Gifts", icon: "M3 8H17V16H3ZM10 4V16M5 8C5 5 10 5 10 8C10 5 15 5 15 8" },
    { id: "profile", label: "Profile", icon: "M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 17c0-3 3-5 6-5s6 2 6 5" },
  ] as const;
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 72,
        background: "rgba(19,18,22,0.92)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: 40,
      }}
    >
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => setTab(it.id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            fontSize: 10.5,
            fontWeight: 700,
            color: tab === it.id ? "var(--magenta)" : "var(--muted)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d={it.icon}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          {it.label}
        </button>
      ))}
    </nav>
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
      setResult(
        await api.claim({
          campaignId: campaign.id,
          contact,
          customerAddress: wallet,
          evidenceText: evidence || "receipt photo",
          receiptRef: `${contact}-${Date.now()}`,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const claimSteps =
    campaign.rewardMode === "gift"
      ? [
          { brand: "World" as const, label: "Checking you are a real, unique person" },
          { brand: "DYNEXA" as const, label: "The agent reviews your proof of purchase" },
          { brand: "DYNEXA" as const, label: "Applying the campaign's rules and limits" },
          { brand: "Circle" as const, label: "The Circle Agent Wallet mints your gift" },
          { brand: "Arc" as const, label: "Confirming the GiftToken on Arc" },
        ]
      : [
          { brand: "World" as const, label: "Checking you are a real, unique person" },
          { brand: "DYNEXA" as const, label: "The agent reviews your proof of purchase" },
          { brand: "DYNEXA" as const, label: "Applying the campaign's rules and limits" },
          { brand: "Circle" as const, label: "The Circle Agent Wallet sends your reward" },
          { brand: "Arc" as const, label: "Confirming the USDC payment on Arc" },
        ];

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
        padding: 16,
        zIndex: 60,
      }}
    >
      {busy && <TrackLoader title="Processing your claim" steps={claimSteps} />}
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
              {error && <p style={{ color: "#ff8a8a", fontSize: 12, marginTop: 8 }}>{error}</p>}
              <button
                className="btn-primary"
                style={{ marginTop: 14 }}
                disabled={busy}
                onClick={submit}
              >
                {busy ? "Working…" : "Submit claim"}
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
      <div style={{ fontSize: 32 }}>
        {good ? "🎉" : result.status === "rejected" ? "⛔" : "⏳"}
      </div>
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
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          justifyContent: "center",
          margin: "12px 0",
        }}
      >
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
