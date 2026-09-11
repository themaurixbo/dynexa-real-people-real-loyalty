"use client";

import { useEffect, useState } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
import { api, type TransferInfo } from "../lib/api";
import { USDC, arcTestnet, giftTransferData, usdcTransferData } from "../lib/chain";
import { Card, TxLink } from "./ui";
import { TrackLoader } from "./loader";

/** Send USDC to a friend by link — they claim it into their own wallet, created on the spot if needed. */
export function SendModal({
  wallet,
  contact,
  onClose,
}: {
  wallet: string;
  contact: string;
  onClose: () => void;
}) {
  const { sendTransaction } = useSendTransaction();
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount above 0.");
      return;
    }
    setBusy(true);
    try {
      const { escrow } = await api.health();
      const { hash } = await sendTransaction({
        to: USDC,
        data: usdcTransferData(escrow, amount),
        chainId: arcTestnet.id,
      });
      const { code } = await api.createTransfer({
        fromAddress: wallet,
        fromContact: contact,
        amountUsdc: amount,
        fromTxHash: hash,
        note: note || undefined,
      });
      setLink(`${window.location.origin}/?gift=${code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const waLink = link
    ? `https://wa.me/?text=${encodeURIComponent(
        `I sent you ${amount} USDC on DYNEXA 🎁 Claim it here: ${link}`,
      )}`
    : null;

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
      {busy && (
        <TrackLoader
          title="Sending your gift"
          steps={[
            { brand: "Privy", label: "Confirming the transfer in your wallet" },
            { brand: "Arc", label: "Sending the USDC on Arc" },
            { brand: "DYNEXA", label: "Creating your share link" },
          ]}
        />
      )}
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380 }}>
        <Card>
          {!link ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Send USDC to a friend</div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                They get a link. No wallet? Privy creates one for them when they claim it.
              </p>
              <div className="label" style={{ marginBottom: 6 }}>
                Amount (USDC)
              </div>
              <input
                className="field"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="label" style={{ marginTop: 12, marginBottom: 6 }}>
                Message (optional)
              </div>
              <input
                className="field"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. for the movies 🍿"
              />
              {error && <p style={{ color: "#ff8a8a", fontSize: 12, marginTop: 8 }}>{error}</p>}
              <button className="btn-primary" style={{ marginTop: 14 }} disabled={busy} onClick={submit}>
                {busy ? "Working…" : "Send"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32 }}>🎁</div>
              <div style={{ fontWeight: 700, fontSize: 16, margin: "6px 0" }}>Gift link ready</div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                Send it to your friend — they claim {amount} USDC on the other end.
              </p>
              <div
                className="num"
                style={{
                  fontSize: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  wordBreak: "break-all",
                  marginBottom: 12,
                }}
              >
                {link}
              </div>
              <a
                className="btn-primary"
                style={{ display: "block", textDecoration: "none", textAlign: "center" }}
                href={waLink ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                Share on WhatsApp
              </a>
              <button
                className="btn-ghost"
                style={{ width: "100%", marginTop: 10 }}
                onClick={() => navigator.clipboard?.writeText(link)}
              >
                Copy link
              </button>
              <button className="btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Shown on the home tab when the page was opened with ?gift=CODE. */
export function ClaimGiftCard({
  code,
  wallet,
  contact,
  onClaimed,
}: {
  code: string;
  wallet: string;
  contact: string;
  onClaimed: () => void;
}) {
  const [info, setInfo] = useState<TransferInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTransfer(code)
      .then(setInfo)
      .catch(() => setNotFound(true));
  }, [code]);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.claimTransfer(code, wallet, contact);
      setTxHash(r.txHash);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (notFound) return null;

  if (txHash) {
    return (
      <Card>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28 }}>🎉</div>
          <div style={{ fontWeight: 700, margin: "4px 0" }}>
            You received {info?.amountUsdc} USDC
          </div>
          <TxLink hash={txHash} />
          <button className="btn-ghost" style={{ width: "100%", marginTop: 12 }} onClick={onClaimed}>
            Nice
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {busy && (
        <TrackLoader
          title="Claiming your gift"
          steps={[
            { brand: "DYNEXA", label: "Looking up the gift link" },
            { brand: "Arc", label: "Sending the USDC to your wallet" },
          ]}
        />
      )}
      <div style={{ fontSize: 28, textAlign: "center" }}>🎁</div>
      <div style={{ fontWeight: 700, textAlign: "center", margin: "4px 0" }}>
        {info ? `Someone sent you ${info.amountUsdc} USDC` : "You have a gift waiting"}
      </div>
      {info?.note && (
        <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>“{info.note}”</p>
      )}
      {info?.status === "claimed" ? (
        <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
          This gift was already claimed.
        </p>
      ) : (
        <>
          {error && (
            <p style={{ color: "#ff8a8a", fontSize: 12, textAlign: "center", marginTop: 8 }}>{error}</p>
          )}
          <button className="btn-primary" style={{ marginTop: 12 }} disabled={busy || !info} onClick={claim}>
            {busy ? "Working…" : "Claim gift"}
          </button>
        </>
      )}
    </Card>
  );
}

/** Gift one of your own GiftTokens to a friend — direct send by contact, or a share link. */
export function GiftShareModal({
  issuanceId,
  tokenId,
  wallet,
  contact,
  onClose,
  onSent,
}: {
  issuanceId: string;
  tokenId: number;
  wallet: string;
  contact: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { sendTransaction } = useSendTransaction();
  const [toContact, setToContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const { giftToken } = await api.health();
      if (!giftToken) throw new Error("Gift contract not configured.");
      const { hash } = await sendTransaction({
        to: giftToken,
        data: giftTransferData(wallet, giftToken, tokenId),
        chainId: arcTestnet.id,
      });
      const r = await api.createGiftTransfer({
        issuanceId,
        fromAddress: wallet,
        fromContact: contact,
        fromTxHash: hash,
        toContact: toContact || undefined,
      });
      if (r.autoDelivered) {
        setDelivered(true);
        onSent();
      } else {
        setLink(`${window.location.origin}/?gift-token=${r.code}`);
        onSent();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const waLink = link
    ? `https://wa.me/?text=${encodeURIComponent(`I sent you a gift on DYNEXA 🎁 Claim it here: ${link}`)}`
    : null;

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
      {busy && (
        <TrackLoader
          title="Gifting it over"
          steps={[
            { brand: "Privy", label: "Confirming the transfer in your wallet" },
            { brand: "Arc", label: "Moving the GiftToken on Arc" },
            { brand: "DYNEXA", label: "Delivering it to your friend" },
          ]}
        />
      )}
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380 }}>
        <Card>
          {delivered ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28 }}>🎉</div>
              <div style={{ fontWeight: 700, margin: "6px 0" }}>Delivered directly</div>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                {toContact} already has a DYNEXA wallet — the gift is theirs now.
              </p>
              <button className="btn-ghost" style={{ width: "100%", marginTop: 12 }} onClick={onClose}>
                Done
              </button>
            </div>
          ) : !link ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Gift this to a friend</div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                Enter their email/phone for direct delivery if they already use DYNEXA — otherwise
                we'll make you a share link.
              </p>
              <div className="label" style={{ marginBottom: 6 }}>
                Friend's email or phone (optional)
              </div>
              <input
                className="field"
                value={toContact}
                onChange={(e) => setToContact(e.target.value)}
                placeholder="friend@email.com"
              />
              {error && <p style={{ color: "#ff8a8a", fontSize: 12, marginTop: 8 }}>{error}</p>}
              <button className="btn-primary" style={{ marginTop: 14 }} disabled={busy} onClick={submit}>
                {busy ? "Working…" : "Gift it"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32 }}>🎁</div>
              <div style={{ fontWeight: 700, fontSize: 16, margin: "6px 0" }}>Gift link ready</div>
              <div
                className="num"
                style={{
                  fontSize: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  wordBreak: "break-all",
                  marginBottom: 12,
                }}
              >
                {link}
              </div>
              <a
                className="btn-primary"
                style={{ display: "block", textDecoration: "none", textAlign: "center" }}
                href={waLink ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                Share on WhatsApp
              </a>
              <button
                className="btn-ghost"
                style={{ width: "100%", marginTop: 10 }}
                onClick={() => navigator.clipboard?.writeText(link)}
              >
                Copy link
              </button>
              <button className="btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Shown when the page opens with ?gift-token=CODE. */
export function ClaimGiftTokenCard({
  code,
  wallet,
  contact,
  onClaimed,
}: {
  code: string;
  wallet: string;
  contact: string;
  onClaimed: () => void;
}) {
  const [info, setInfo] = useState<{ campaignName: string; note?: string; status: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    api
      .getGiftTransfer(code)
      .then(setInfo)
      .catch(() => setNotFound(true));
  }, [code]);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.claimGiftTransfer(code, wallet, contact);
      setTxHash(r.txHash);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (notFound) return null;

  if (txHash) {
    return (
      <Card>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28 }}>🎉</div>
          <div style={{ fontWeight: 700, margin: "4px 0" }}>You received a gift!</div>
          <TxLink hash={txHash} />
          <button className="btn-ghost" style={{ width: "100%", marginTop: 12 }} onClick={onClaimed}>
            Nice
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {busy && (
        <TrackLoader
          title="Claiming your gift"
          steps={[
            { brand: "DYNEXA", label: "Looking up the gift" },
            { brand: "Arc", label: "Sending the GiftToken to your wallet" },
          ]}
        />
      )}
      <div style={{ fontSize: 28, textAlign: "center" }}>🎁</div>
      <div style={{ fontWeight: 700, textAlign: "center", margin: "4px 0" }}>
        {info ? `Someone sent you: ${info.campaignName}` : "You have a gift waiting"}
      </div>
      {info?.status === "claimed" ? (
        <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
          This gift was already claimed.
        </p>
      ) : (
        <>
          {error && (
            <p style={{ color: "#ff8a8a", fontSize: 12, textAlign: "center", marginTop: 8 }}>{error}</p>
          )}
          <button className="btn-primary" style={{ marginTop: 12 }} disabled={busy || !info} onClick={claim}>
            {busy ? "Working…" : "Claim gift"}
          </button>
        </>
      )}
    </Card>
  );
}

/** Generate (or fetch) your own referral link for a campaign, ready to share. */
export function ReferralModal({
  campaignId,
  wallet,
  contact,
  onClose,
}: {
  campaignId: string;
  wallet: string;
  contact: string;
  onClose: () => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api
      .referralLink(campaignId, contact, wallet)
      .then((r) => setLink(`${window.location.origin}/?ref=${r.code}`))
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(false));
  }, [campaignId, contact, wallet]);

  const waLink = link
    ? `https://wa.me/?text=${encodeURIComponent(`Join me on DYNEXA and we both earn a reward 🎁 ${link}`)}`
    : null;

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
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380 }}>
        <Card>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28 }}>🔗</div>
            <div style={{ fontWeight: 700, fontSize: 16, margin: "6px 0" }}>Your referral link</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              When a friend joins with this link and completes the campaign, you both get paid.
            </p>
            {busy && <p style={{ color: "var(--muted)", fontSize: 13 }}>Generating…</p>}
            {error && <p style={{ color: "#ff8a8a", fontSize: 12 }}>{error}</p>}
            {link && (
              <>
                <div
                  className="num"
                  style={{
                    fontSize: 12,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    wordBreak: "break-all",
                    marginBottom: 12,
                  }}
                >
                  {link}
                </div>
                <a
                  className="btn-primary"
                  style={{ display: "block", textDecoration: "none", textAlign: "center" }}
                  href={waLink ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  Share on WhatsApp
                </a>
                <button
                  className="btn-ghost"
                  style={{ width: "100%", marginTop: 10 }}
                  onClick={() => navigator.clipboard?.writeText(link)}
                >
                  Copy link
                </button>
              </>
            )}
            <button className="btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>
              Done
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
