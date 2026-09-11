"use client";

import { useEffect, useState } from "react";
import { api, type Campaign, type Claim } from "../lib/api";
import { fileToDataUrl } from "../lib/image";
import { Card, TxLink } from "./ui";
import { TrackLoader, type TrackStep } from "./loader";

const CATEGORIES = ["shopping", "food", "events"] as const;
const CATEGORY_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  shopping: "Shopping",
  food: "Food",
  events: "Events",
};

/** Same slugify the backend uses, so the dashboard can tell which campaigns are "mine". */
function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function BusinessApp() {
  const [businessName, setBusinessName] = useState("Vacafría");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [businesses, setBusinesses] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [killSwitch, setKillSwitchOn] = useState(false);
  const [tab, setTab] = useState<"campaigns" | "create" | "approvals" | "history" | "pos">("campaigns");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("dynexa_business_name") : null;
    if (saved) setBusinessName(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("dynexa_business_name", businessName);
  }, [businessName]);

  const refresh = () => {
    api.campaigns().then(setCampaigns);
    api.businesses().then(setBusinesses);
    api.killSwitch().then((r) => setKillSwitchOn(r.paused));
  };
  useEffect(refresh, []);

  const mySlug = slugify(businessName);
  const myBusiness = businesses.find((b) => b.slug === mySlug);
  // Multi-tenant: only this business's own campaigns, once it exists server-side.
  const myCampaigns = myBusiness ? campaigns.filter((c) => c.businessId === myBusiness.id) : [];

  async function toggleKillSwitch() {
    const next = !killSwitch;
    await api.setKillSwitch(next);
    setKillSwitchOn(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="label">Business</div>
        <input
          className="field"
          style={{ maxWidth: 220 }}
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
        <button
          className="btn-ghost"
          style={{
            marginLeft: "auto",
            color: killSwitch ? "#ff8a8a" : "var(--muted)",
            borderColor: killSwitch ? "rgba(255,138,138,0.4)" : undefined,
          }}
          onClick={toggleKillSwitch}
        >
          {killSwitch ? "⛔ All payouts paused — resume" : "Kill switch: pause all payouts"}
        </button>
      </div>

      <div className="mode-switch" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
        {(["campaigns", "create", "approvals", "history", "pos"] as const).map((t) => (
          <button key={t} className={`mode-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "campaigns"
              ? "Campaigns"
              : t === "create"
                ? "New campaign"
                : t === "approvals"
                  ? "Approvals"
                  : t === "history"
                    ? "History"
                    : "POS"}
          </button>
        ))}
      </div>

      {tab === "campaigns" && <CampaignList campaigns={myCampaigns} onChange={refresh} />}
      {tab === "create" && (
        <CreateCampaign
          businessName={businessName}
          onCreated={() => {
            refresh();
            setTab("campaigns");
          }}
        />
      )}
      {tab === "approvals" && (
        <Approvals campaignIds={myCampaigns.map((c) => c.id)} campaigns={myCampaigns} onChange={refresh} />
      )}
      {tab === "history" && <History campaignIds={myCampaigns.map((c) => c.id)} campaigns={myCampaigns} />}
      {tab === "pos" && <Pos />}
    </div>
  );
}

function CampaignList({ campaigns, onChange }: { campaigns: Campaign[]; onChange: () => void }) {
  const [editing, setEditing] = useState<Campaign | null>(null);
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
      {campaigns.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No campaigns yet for this business.</p>
      )}
      {campaigns.map((c) => {
        const noFunds =
          c.rewardMode === "usdc" &&
          c.status === "active" &&
          Number(c.onchainBalance ?? 0) < Number(c.rewardPerUserUsdc);
        return (
          <Card key={c.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>
                  {CATEGORY_LABEL[c.category]} · {c.rewardType} · {c.rewardMode} · {c.status}
                </div>
              </div>
              <span className="num" style={{ color: "var(--cyan)", fontWeight: 700 }}>
                {c.onchainBalance ?? "0"} USDC
              </span>
            </div>
            {noFunds && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#ff8a8a",
                  background: "rgba(255,138,138,0.1)",
                  border: "1px solid rgba(255,138,138,0.3)",
                  borderRadius: 8,
                  padding: "5px 8px",
                  display: "inline-block",
                }}
              >
                ⚠ NO FUNDS — balance is below the reward amount
              </div>
            )}
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              {Number(c.rewardPerUserUsdc)} / reward · max {Number(c.maxPerTxUsdc)} / tx ·{" "}
              {c.maxUsesPerHuman} per person
              {c.maxParticipants ? ` · up to ${c.maxParticipants} participants` : ""}
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
              <button className="btn-ghost" onClick={() => setEditing(c)}>
                Edit
              </button>
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
        );
      })}
      {editing && (
        <EditCampaignModal
          campaign={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function EditCampaignModal({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: Campaign;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    qualifyCondition: campaign.qualifyCondition ?? "",
    maxUsesPerHuman: campaign.maxUsesPerHuman,
    maxParticipants: campaign.maxParticipants ?? undefined,
    requiresApprovalAboveUsdc: campaign.requiresApprovalAboveUsdc ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.editCampaign(campaign.id, {
        qualifyCondition: f.qualifyCondition,
        maxUsesPerHuman: f.maxUsesPerHuman,
        maxParticipants: f.maxParticipants || null,
        requiresApprovalAboveUsdc: f.requiresApprovalAboveUsdc || null,
      });
      onSaved();
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
        padding: 16,
        zIndex: 60,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Edit {campaign.name}</div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            The on-chain per-tx and total budget limits are fixed by the contract — only the rules
            below can change.
          </p>
          <Field label="Condition to qualify">
            <textarea
              className="field"
              rows={2}
              value={f.qualifyCondition}
              onChange={(e) => setF((s) => ({ ...s, qualifyCondition: e.target.value }))}
            />
          </Field>
          <Row>
            <Field label="Max per person">
              <input
                className="field"
                type="number"
                value={f.maxUsesPerHuman}
                onChange={(e) => setF((s) => ({ ...s, maxUsesPerHuman: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Max participants">
              <input
                className="field"
                type="number"
                value={f.maxParticipants ?? ""}
                onChange={(e) =>
                  setF((s) => ({ ...s, maxParticipants: e.target.value ? Number(e.target.value) : undefined }))
                }
              />
            </Field>
          </Row>
          <Field label="Approval threshold (USDC) — above this needs manual approval">
            <input
              className="field"
              value={f.requiresApprovalAboveUsdc}
              onChange={(e) => setF((s) => ({ ...s, requiresApprovalAboveUsdc: e.target.value }))}
              placeholder="none"
            />
          </Field>
          {error && <p style={{ color: "#ff8a8a", fontSize: 12, marginTop: 8 }}>{error}</p>}
          <button className="btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </Card>
      </div>
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

function CreateCampaign({ businessName, onCreated }: { businessName: string; onCreated: () => void }) {
  const [f, setF] = useState({
    name: "Verified Human Welcome",
    category: "shopping" as (typeof CATEGORIES)[number],
    rewardType: "receipt" as "receipt" | "selfie" | "referral",
    rewardMode: "usdc" as "usdc" | "gift",
    rewardPerUserUsdc: "5",
    totalBudgetUsdc: "100",
    maxPerTxUsdc: "5",
    maxUsesPerHuman: 3,
    maxParticipants: "",
    requiresApprovalAboveUsdc: "",
    startsAt: "",
    endsAt: "",
    qualifyCondition: "Buy any product at Vacafría and upload a photo of the receipt.",
    giftName: "Helado de Pistacho",
    giftTransferable: false,
  });
  const [refImages, setRefImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string | number | boolean) => setF((s) => ({ ...s, [k]: v }));

  async function addRefImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || refImages.length >= 4) return;
    try {
      setRefImages((imgs) => [...imgs, ]);
      const url = await fileToDataUrl(file, 640, 0.6);
      setRefImages((imgs) => {
        const copy = [...imgs];
        copy[copy.length - 1] = url;
        return copy;
      });
    } catch {
      setRefImages((imgs) => imgs.slice(0, -1));
    }
  }

  return (
    <Card style={{ maxWidth: 560 }}>
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

        <Field label="Category">
          <div className="mode-switch">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`mode-tab ${f.category === cat ? "active" : ""}`}
                onClick={() => set("category", cat)}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Reward type — how the customer proves it">
          <div className="mode-switch">
            {(["receipt", "selfie", "referral"] as const).map((rt) => (
              <button
                key={rt}
                className={`mode-tab ${f.rewardType === rt ? "active" : ""}`}
                onClick={() => set("rewardType", rt)}
              >
                {rt === "receipt" ? "Purchase Receipt" : rt === "selfie" ? "Consumption Selfie" : "Referral"}
              </button>
            ))}
          </div>
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
        <Row>
          <Field label="Max participants (optional)">
            <input
              className="field"
              type="number"
              value={f.maxParticipants}
              onChange={(e) => set("maxParticipants", e.target.value)}
              placeholder="unlimited"
            />
          </Field>
          <Field label="Approval threshold (USDC, optional)">
            <input
              className="field"
              value={f.requiresApprovalAboveUsdc}
              onChange={(e) => set("requiresApprovalAboveUsdc", e.target.value)}
              placeholder="none — auto-approve"
            />
          </Field>
        </Row>
        <Row>
          <Field label="Starts (optional)">
            <input
              className="field"
              type="datetime-local"
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </Field>
          <Field label="Ends (optional)">
            <input className="field" type="datetime-local" onChange={(e) => set("endsAt", e.target.value)} />
          </Field>
        </Row>
        {f.rewardMode === "gift" && (
          <>
            <Field label="Gift name">
              <input className="field" value={f.giftName} onChange={(e) => set("giftName", e.target.value)} />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={f.giftTransferable}
                onChange={(e) => set("giftTransferable", e.target.checked)}
              />
              Let customers gift this to a friend
            </label>
          </>
        )}
        <Field label="Condition to qualify (shown to customers, used by the AI)">
          <textarea
            className="field"
            rows={2}
            value={f.qualifyCondition}
            onChange={(e) => set("qualifyCondition", e.target.value)}
          />
        </Field>
        <Field label="Reference images (optional, up to 4) — helps the AI recognize the real product">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {refImages.map((img, i) => (
              <img
                key={i}
                src={img || undefined}
                style={{
                  width: 56,
                  height: 56,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                }}
              />
            ))}
            {refImages.length < 4 && (
              <label
                className="btn-ghost"
                style={{ width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                +
                <input type="file" accept="image/*" onChange={addRefImage} style={{ display: "none" }} />
              </label>
            )}
          </div>
        </Field>
        {error && <p style={{ color: "#ff8a8a", fontSize: 12 }}>{error}</p>}
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.createCampaign({
                ...f,
                businessName,
                maxParticipants: f.maxParticipants ? Number(f.maxParticipants) : undefined,
                requiresApprovalAboveUsdc: f.requiresApprovalAboveUsdc || undefined,
                startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : undefined,
                endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined,
                referenceImages: refImages.filter(Boolean),
              });
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

function Approvals({
  campaignIds,
  campaigns,
  onChange,
}: {
  campaignIds: string[];
  campaigns: Campaign[];
  onChange: () => void;
}) {
  const [pending, setPending] = useState<Claim[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api.claims({ status: "pending" }).then((rows) => setPending(rows.filter((r) => campaignIds.includes(r.campaignId))));
  }, [campaignIds]);

  const nameFor = (id: string) => campaigns.find((c) => c.id === id)?.name ?? "Campaign";

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      if (action === "approve") await api.approveClaim(id);
      else await api.rejectClaim(id);
      setPending((p) => p.filter((c) => c.id !== id));
      onChange();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (pending.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No claims waiting for manual approval.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {pending.map((c) => (
        <Card key={c.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{nameFor(c.campaignId)}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {c.cashAmountUsdc ? `${Number(c.cashAmountUsdc)} USDC` : "gift"} ·{" "}
                {new Date(c.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" disabled={busyId === c.id} onClick={() => act(c.id, "reject")}>
                Reject
              </button>
              <button className="btn-primary" style={{ width: "auto", padding: "10px 16px" }} disabled={busyId === c.id} onClick={() => act(c.id, "approve")}>
                {busyId === c.id ? "…" : "Approve"}
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function History({ campaignIds, campaigns }: { campaignIds: string[]; campaigns: Campaign[] }) {
  const [rows, setRows] = useState<Claim[]>([]);

  useEffect(() => {
    Promise.all([api.claims({ status: "paid" }), api.claims({ status: "rejected" })]).then(([a, b]) => {
      const all = [...a, ...b].filter((r) => campaignIds.includes(r.campaignId));
      all.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
      setRows(all);
    });
  }, [campaignIds]);

  const nameFor = (id: string) => campaigns.find((c) => c.id === id)?.name ?? "Campaign";

  if (rows.length === 0) return <p style={{ color: "var(--muted)" }}>No decisions yet.</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "var(--muted)", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>
            <th style={{ padding: "6px 8px" }}>Campaign</th>
            <th style={{ padding: "6px 8px" }}>Status</th>
            <th style={{ padding: "6px 8px" }}>Amount</th>
            <th style={{ padding: "6px 8px" }}>Reason</th>
            <th style={{ padding: "6px 8px" }}>When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <td style={{ padding: "8px" }}>{nameFor(r.campaignId)}</td>
              <td style={{ padding: "8px" }}>
                <span
                  style={{
                    fontWeight: 700,
                    color: r.status === "paid" ? "var(--green)" : "#ff8a8a",
                  }}
                >
                  {r.status === "paid" ? "✓ paid" : "✗ rejected"}
                </span>
              </td>
              <td style={{ padding: "8px" }} className="num">
                {r.cashAmountUsdc ? Number(r.cashAmountUsdc) : "—"}
              </td>
              <td style={{ padding: "8px", color: "var(--muted)" }}>{r.rejectionReason ?? "—"}</td>
              <td style={{ padding: "8px", color: "var(--muted)" }} className="num">
                {new Date(r.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
