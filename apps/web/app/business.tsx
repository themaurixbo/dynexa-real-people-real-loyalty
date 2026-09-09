"use client";

import { useEffect, useState } from "react";
import { api, type Campaign } from "../lib/api";
import { Card, TxLink } from "./ui";
import { TrackLoader, type TrackStep } from "./loader";

export function BusinessApp() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tab, setTab] = useState<"campaigns" | "create" | "pos">("campaigns");

  const refresh = () => api.campaigns().then(setCampaigns);
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="mode-switch" style={{ alignSelf: "flex-start" }}>
        {(["campaigns", "create", "pos"] as const).map((t) => (
          <button
            key={t}
            className={`mode-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "campaigns" ? "Campaigns" : t === "create" ? "New campaign" : "POS"}
          </button>
        ))}
      </div>

      {tab === "campaigns" && <CampaignList campaigns={campaigns} onChange={refresh} />}
      {tab === "create" && (
        <CreateCampaign
          onCreated={() => {
            refresh();
            setTab("campaigns");
          }}
        />
      )}
      {tab === "pos" && <Pos />}
    </div>
  );
}

function CampaignList({ campaigns, onChange }: { campaigns: Campaign[]; onChange: () => void }) {
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
      {campaigns.length === 0 && <p style={{ color: "var(--muted)" }}>No campaigns yet.</p>}
      {campaigns.map((c) => (
        <Card key={c.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>
                {c.rewardMode} · {c.status}
              </div>
            </div>
            <span className="num" style={{ color: "var(--cyan)", fontWeight: 700 }}>
              {c.onchainBalance ?? "0"} USDC
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            {Number(c.rewardPerUserUsdc)} / reward · max {Number(c.maxPerTxUsdc)} / tx · {c.maxUsesPerHuman} per person
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Action
              label="Fund 5"
              run={() => api.fund(c.id, "5")}
              onChange={onChange}
              steps={[
                { brand: "Arc", label: "Approving USDC for the campaign treasury" },
                { brand: "Arc", label: "Moving the funds into the treasury" },
                { brand: "Arc", label: "Confirming on Arc" },
              ]}
            />
            <Action
              label={c.status === "paused" ? "Resume" : "Pause"}
              run={() => api.pause(c.id, c.status !== "paused")}
              onChange={onChange}
              steps={[{ brand: "Arc", label: "Updating the campaign on Arc" }]}
            />
            <Action
              label="Close"
              run={() => api.close(c.id)}
              onChange={onChange}
              steps={[
                { brand: "Arc", label: "Closing the campaign" },
                { brand: "Arc", label: "Refunding the remaining USDC to the business" },
              ]}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Action({
  label,
  run,
  onChange,
  steps,
}: {
  label: string;
  run: () => Promise<unknown>;
  onChange: () => void;
  steps?: TrackStep[];
}) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      {busy && steps && <TrackLoader steps={steps} />}
      <button
        className="btn-ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await run();
            onChange();
          } catch (e) {
            alert((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "…" : label}
      </button>
    </>
  );
}

function CreateCampaign({ onCreated }: { onCreated: () => void }) {
  const [f, setF] = useState({
    name: "Verified Human Welcome",
    rewardMode: "usdc" as "usdc" | "gift",
    rewardPerUserUsdc: "5",
    totalBudgetUsdc: "100",
    maxPerTxUsdc: "5",
    maxUsesPerHuman: 3,
    qualifyCondition: "Buy any product at Vacafría and upload a photo of the receipt.",
    giftName: "Helado de Pistacho",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string | number) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Card style={{ maxWidth: 520 }}>
      {busy && (
        <TrackLoader
          title="Creating the campaign"
          steps={
            f.rewardMode === "gift"
              ? [
                  { brand: "Arc", label: "Deploying the campaign treasury on Arc" },
                  { brand: "Arc", label: "Registering the branded gift (GiftToken)" },
                ]
              : [
                  { brand: "Arc", label: "Deploying the campaign treasury on Arc" },
                  { brand: "Arc", label: "Setting the per-tx and total limits on-chain" },
                ]
          }
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Campaign name">
          <input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Reward">
          <div className="mode-switch">
            {(["usdc", "gift"] as const).map((m) => (
              <button
                key={m}
                className={`mode-tab ${f.rewardMode === m ? "active" : ""}`}
                onClick={() => set("rewardMode", m)}
              >
                {m === "usdc" ? "USDC" : "GiftToken"}
              </button>
            ))}
          </div>
        </Field>
        <Row>
          <Field label="Reward per user (USDC)">
            <input
              className="field"
              value={f.rewardPerUserUsdc}
              onChange={(e) => set("rewardPerUserUsdc", e.target.value)}
            />
          </Field>
          <Field label="Total budget (USDC)">
            <input
              className="field"
              value={f.totalBudgetUsdc}
              onChange={(e) => set("totalBudgetUsdc", e.target.value)}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Max per transaction">
            <input
              className="field"
              value={f.maxPerTxUsdc}
              onChange={(e) => set("maxPerTxUsdc", e.target.value)}
            />
          </Field>
          <Field label="Max per person">
            <input
              className="field"
              type="number"
              value={f.maxUsesPerHuman}
              onChange={(e) => set("maxUsesPerHuman", Number(e.target.value))}
            />
          </Field>
        </Row>
        {f.rewardMode === "gift" && (
          <Field label="Gift name">
            <input className="field" value={f.giftName} onChange={(e) => set("giftName", e.target.value)} />
          </Field>
        )}
        <Field label="Condition to qualify (shown to customers, used by the AI)">
          <textarea
            className="field"
            rows={2}
            value={f.qualifyCondition}
            onChange={(e) => set("qualifyCondition", e.target.value)}
          />
        </Field>
        {error && <p style={{ color: "#ff8a8a", fontSize: 12 }}>{error}</p>}
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.createCampaign(f);
              onCreated();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Deploying on Arc…" : "Create & fund campaign"}
        </button>
      </div>
    </Card>
  );
}

function Pos() {
  const [code, setCode] = useState("");
  const [res, setRes] = useState<{ status: string; reason?: string; txHash?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card style={{ maxWidth: 420 }}>
      {busy && (
        <TrackLoader
          title="Redeeming the gift"
          steps={[
            { brand: "DYNEXA", label: "Looking up the gift code" },
            { brand: "Arc", label: "Redeeming and burning the GiftToken on Arc" },
          ]}
        />
      )}
      <div className="label" style={{ marginBottom: 6 }}>
        Point of sale — redeem a gift
      </div>
      <input
        className="field"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="GIFT-XXXX-XXXX"
      />
      <button
        className="btn-primary"
        style={{ marginTop: 12 }}
        disabled={busy || !code}
        onClick={async () => {
          setBusy(true);
          try {
            setRes(await api.redeem(code));
          } catch (e) {
            setRes({ status: "rejected", reason: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking…" : "Validate & redeem"}
      </button>
      {res && (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <div style={{ fontSize: 24 }}>{res.status === "success" ? "✅" : "⛔"}</div>
          <div style={{ fontWeight: 700 }}>
            {res.status === "success" ? "Gift redeemed" : "Redemption blocked"}
          </div>
          {res.reason && (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>{res.reason}</p>
          )}
          <TxLink hash={res.txHash} />
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div className="label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10 }}>{children}</div>;
}
