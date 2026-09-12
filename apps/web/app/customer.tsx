"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { api, type Campaign, type ClaimResult } from "../lib/api";
import { usdcBalance } from "../lib/chain";
import { fileToDataUrl } from "../lib/image";
import { BrandMark, Card, ErrorNote, Logo, Partner, TxLink, WalletCard } from "./ui";
import { TrackLoader } from "./loader";
import { ClaimGiftCard, ClaimGiftTokenCard, GiftShareModal, ReferralModal, SendModal } from "./send";
import { WorldVerify, useWorldStatus } from "./world";

type Gift = {
  id: string;
  tokenId: number;
  code: string;
  status: string;
  campaignId: string;
  campaignName: string;
  transferable: boolean;
};

const CATEGORIES = ["all", "shopping", "food", "events"] as const;
type Category = (typeof CATEGORIES)[number];
const CATEGORY_LABEL: Record<Category, string> = {
  all: "All",
  shopping: "Shopping",
  food: "Food",
  events: "Events",
};

function clearParam(name: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete(name);
  window.history.replaceState(null, "", url.pathname + url.search);
}

export function CustomerApp() {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const wallet = useMemo(
    () => wallets.find((w) => w.walletClientType === "privy") ?? wallets[0],
    [wallets],
  );
  const [giftCode, setGiftCode] = useState<string | null>(null);
  const [giftTokenCode, setGiftTokenCode] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCampaignId, setReferralCampaignId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gift = params.get("gift");
    const giftToken = params.get("gift-token");
    const ref = params.get("ref");
    if (gift) setGiftCode(gift.toUpperCase());
    if (giftToken) setGiftTokenCode(giftToken.toUpperCase());
    if (ref) {
      const code = ref.toUpperCase();
      setReferralCode(code);
      api
        .referralLinkInfo(code)
        .then((r) => setReferralCampaignId(r.campaignId))
        .catch(() => {});
    }
  }, []);

  if (!ready) return <p style={{ color: "var(--muted)" }}>Loading…</p>;

  if (!authenticated) {
    const hasInvite = giftCode || giftTokenCode || referralCode;
    return (
      <div style={{ textAlign: "center", padding: "48px 4px 0" }}>
        <Logo size={72} />
        <h1 className="num" style={{ fontSize: 26, marginTop: 20, marginBottom: 10 }}>
          DYNEXA
        </h1>
        <p style={{ color: "var(--muted)", maxWidth: 300, margin: "0 auto 28px", lineHeight: 1.5 }}>
          Real rewards for real, human-verified people. No wallet setup, no seed phrase.
        </p>
        {hasInvite && (
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              margin: "0 auto 16px",
              color: "var(--magenta)",
            }}
          >
            {giftCode || giftTokenCode
              ? "🎁 Someone sent you a gift — sign in to claim it"
              : "🔗 You were invited — sign in to see the reward"}
          </p>
        )}
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

  return (
    <Home
      wallet={wallet.address}
      contact={contact}
      giftCode={giftCode}
      onGiftHandled={() => {
        setGiftCode(null);
        clearParam("gift");
      }}
      giftTokenCode={giftTokenCode}
      onGiftTokenHandled={() => {
        setGiftTokenCode(null);
        clearParam("gift-token");
      }}
      referralCode={referralCode}
      referralCampaignId={referralCampaignId}
    />
  );
}

function Home({
  wallet,
  contact,
  giftCode,
  onGiftHandled,
  giftTokenCode,
  onGiftTokenHandled,
  referralCode,
  referralCampaignId,
}: {
  wallet?: string;
  contact: string;
  giftCode?: string | null;
  onGiftHandled?: () => void;
  giftTokenCode?: string | null;
  onGiftTokenHandled?: () => void;
  referralCode?: string | null;
  referralCampaignId?: string | null;
}) {
  const [tab, setTab] = useState<"home" | "wallet" | "gifts" | "profile">("home");
  const { verified, setVerified } = useWorldStatus(wallet);
  const [balance, setBalance] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [category, setCategory] = useState<Category>("all");
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [claiming, setClaiming] = useState<Campaign | null>(null);
  const [referring, setReferring] = useState<Campaign | null>(null);
  const [sending, setSending] = useState(false);
  const [gifting, setGifting] = useState<Gift | null>(null);
  const [welcomeGift, setWelcomeGift] = useState<{ code?: string; txHash?: string } | null>(null);

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

  const grantWelcome = useCallback(() => {
    if (!wallet || !contact) return;
    api
      .welcome(contact, wallet)
      .then((r) => {
        if (r.granted) {
          setWelcomeGift({ code: r.code, txHash: r.txHash });
          load();
        }
      })
      .catch(() => {});
  }, [wallet, contact, load]);

  useEffect(() => {
    load();
    grantWelcome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, contact]);

  const filteredCampaigns = campaigns.filter((c) => category === "all" || c.category === category);

  return (
    <div style={{ paddingBottom: 88 }}>
      {(tab === "home" || tab === "wallet") && (
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tab === "home" && giftCode && wallet && (
            <ClaimGiftCard
              code={giftCode}
              wallet={wallet}
              contact={contact}
              onClaimed={() => {
                onGiftHandled?.();
                load();
              }}
            />
          )}
          {tab === "home" && giftTokenCode && wallet && (
            <ClaimGiftTokenCard
              code={giftTokenCode}
              wallet={wallet}
              contact={contact}
              onClaimed={() => {
                onGiftTokenHandled?.();
                load();
              }}
            />
          )}

          {verified ? (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "radial-gradient(circle at 35% 30%, #1c1b22, #0b0a10)",
                    border: "1px solid rgba(52,211,153,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--green)",
                  }}
                >
                  <BrandMark name="World" size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>You&apos;re Human Verified</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    Verified with World — real, unique, one account.
                  </div>
                </div>
              </div>
            </Card>
          ) : wallet ? (
            <Card>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    margin: "4px auto 14px",
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 30%, #232030, #0b0a10)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    boxShadow: "0 0 0 6px rgba(209,140,255,0.06), 0 0 30px rgba(209,140,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  <BrandMark name="World" size={36} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>Verify you&apos;re human</div>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 16px", lineHeight: 1.5 }}>
                  One quick check with World — a few seconds, no personal data stored.
                  Unlocks your welcome gift and every reward after it.
                </p>
                <WorldVerify
                  contact={contact}
                  wallet={wallet}
                  onVerified={() => {
                    setVerified(true);
                    grantWelcome();
                  }}
                />
              </div>
            </Card>
          ) : null}

          <WalletCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                className="label"
                style={{ color: "var(--gold)", letterSpacing: 1.2, display: "flex", alignItems: "center", gap: 7 }}
              >
                <Logo size={16} /> Available balance
              </div>
              <Partner name="Privy" />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 16 }}>
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                <span className="num" style={{ fontSize: 40, fontWeight: 800, color: "var(--gold)" }}>
                  {balance ?? "—"}
                </span>
                <span className="num" style={{ fontSize: 15, fontWeight: 600, color: "var(--muted)" }}>
                  USDC
                </span>
              </span>
              {wallet && (
                <button
                  className="btn-ghost"
                  style={{
                    fontSize: 12,
                    padding: "8px 12px",
                    background: "rgba(224,184,110,0.1)",
                    borderColor: "rgba(224,184,110,0.35)",
                  }}
                  onClick={() => setSending(true)}
                >
                  Send to a friend
                </button>
              )}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px solid rgba(224,184,110,0.16)",
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
          </WalletCard>
        </section>
      )}

      {sending && wallet && (
        <SendModal wallet={wallet} contact={contact} onClose={() => setSending(false)} />
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
              <FlippableGiftCard key={g.id} gift={g} onGiftThis={() => setGifting(g)} />
            ))}
          </div>
        </section>
      )}

      {tab === "home" && (
        <section style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          <div className="label">Available rewards</div>
          <div className="mode-switch" style={{ alignSelf: "flex-start" }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`mode-tab ${category === c ? "active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          {filteredCampaigns.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No active campaigns right now.</p>
          )}
          {filteredCampaigns.map((c) => {
            const isMyInvite = c.rewardType === "referral" && referralCampaignId === c.id;
            const isReferralHome = c.rewardType === "referral" && !isMyInvite;
            return (
              <Card key={c.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                  <Partner name="Arc" />
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {c.rewardMode === "usdc" ? `${Number(c.rewardPerUserUsdc)} USDC` : "A branded gift"} ·
                  up to {c.maxUsesPerHuman} per person
                  {c.rewardType === "selfie" ? " · selfie required" : ""}
                  {c.rewardType === "referral" ? " · refer a friend" : ""}
                </div>
                <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>{c.qualifyCondition}</p>
                <button
                  className="btn-primary"
                  style={{ marginTop: 14 }}
                  onClick={() => (isReferralHome ? setReferring(c) : setClaiming(c))}
                >
                  {isReferralHome ? "Get my referral link" : "Claim reward"}
                </button>
              </Card>
            );
          })}
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
          referralCode={referralCampaignId === claiming.id ? (referralCode ?? undefined) : undefined}
          onClose={() => {
            setClaiming(null);
            load();
          }}
        />
      )}

      {referring && wallet && (
        <ReferralModal
          campaignId={referring.id}
          wallet={wallet}
          contact={contact}
          onClose={() => setReferring(null)}
        />
      )}

      {gifting && wallet && (
        <GiftShareModal
          issuanceId={gifting.id}
          tokenId={gifting.tokenId}
          wallet={wallet}
          contact={contact}
          onClose={() => setGifting(null)}
          onSent={load}
        />
      )}

      {welcomeGift && (
        <WelcomeGiftModal onClose={() => setWelcomeGift(null)} txHash={welcomeGift.txHash} />
      )}

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

function WelcomeGiftModal({ onClose, txHash }: { onClose: () => void; txHash?: string }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 70,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340 }}>
        <Card>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 18, margin: "8px 0 4px" }}>Welcome gift unlocked!</div>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              Thanks for verifying you're a real person. Check your Gifts tab.
            </p>
            <TxLink hash={txHash} />
            <button className="btn-primary" style={{ marginTop: 14 }} onClick={onClose}>
              Nice!
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FlippableGiftCard({ gift, onGiftThis }: { gift: Gift; onGiftThis: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const redeemed = gift.status === "redeemed";
  return (
    <div
      style={{ perspective: 800, opacity: redeemed ? 0.45 : 1 }}
      onClick={() => !redeemed && setFlipped((f) => !f)}
    >
      <div
        style={{
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 0.5s",
          transform: flipped ? "rotateY(180deg)" : "none",
          minHeight: 150,
          cursor: redeemed ? "default" : "pointer",
        }}
      >
        <div className="glass" style={{ backfaceVisibility: "hidden" }}>
          <div className="glassin" style={{ padding: 14, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Logo size={30} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>{gift.campaignName}</div>
            <div className="num" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
              #{gift.tokenId} · {gift.status}
            </div>
            {!redeemed && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>tap to flip</div>}
          </div>
        </div>
        <div
          className="glass"
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="glassin" style={{ padding: 12, textAlign: "center" }}>
            {!redeemed ? (
              <>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(gift.code)}`}
                  alt="QR"
                  width={64}
                  height={64}
                  style={{ borderRadius: 6, background: "#fff", padding: 3 }}
                />
                <div
                  className="num"
                  style={{
                    marginTop: 6,
                    fontSize: 10.5,
                    letterSpacing: 0.5,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "4px 4px",
                  }}
                >
                  {gift.code}
                </div>
                {gift.transferable && (
                  <button
                    className="btn-ghost"
                    style={{ marginTop: 6, fontSize: 10.5, padding: "6px 8px", width: "100%" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onGiftThis();
                    }}
                  >
                    Gift this
                  </button>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Redeemed</div>
            )}
          </div>
        </div>
      </div>
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

/** Live front-camera capture — no picking a file from disk, has to be an actual selfie. */
function SelfieCapture({
  onCapture,
  onError,
}: {
  onCapture: (dataUrl: string) => void;
  onError: (msg: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
        setReady(true);
      })
      .catch(() => setDenied(true));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      onError("Camera isn't ready yet, give it a second.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.82));
  }

  if (denied) {
    return (
      <p style={{ color: "#ff8a8a", fontSize: 12.5, textAlign: "center", padding: "20px 10px" }}>
        Camera access is off. Allow it in your browser settings to take the selfie.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ position: "relative", borderRadius: 13, overflow: "hidden", background: "#000" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", maxHeight: 240, objectFit: "cover", transform: "scaleX(-1)", display: "block" }}
        />
        {!ready && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
              fontSize: 12,
            }}
          >
            Starting camera…
          </div>
        )}
      </div>
      <button className="btn-primary" disabled={!ready} onClick={capture}>
        📸 Take selfie
      </button>
    </div>
  );
}

function ClaimModal({
  campaign,
  contact,
  wallet,
  referralCode,
  onClose,
}: {
  campaign: Campaign;
  contact: string;
  wallet?: string;
  referralCode?: string;
  onClose: () => void;
}) {
  const isSelfie = campaign.rewardType === "selfie";
  const [photo, setPhoto] = useState<string | null>(null);
  const [socialLink, setSocialLink] = useState("");
  const [useLink, setUseLink] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    try {
      setPhoto(await fileToDataUrl(file));
    } catch (err) {
      setPhotoError((err as Error).message);
    }
  }

  async function submit() {
    const evidenceUrl = useLink ? socialLink.trim() : photo;
    if (!evidenceUrl) {
      setError(useLink ? "Paste a link to your post first." : "Add a photo first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api.claim({
          campaignId: campaign.id,
          contact,
          customerAddress: wallet,
          evidenceUrl,
          receiptRef: `${contact}-${Date.now()}`,
          referralCode,
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
          { brand: "DYNEXA" as const, label: "The agent reviews your proof" },
          { brand: "DYNEXA" as const, label: "Applying the campaign's rules and limits" },
          { brand: "Circle" as const, label: "The Circle Agent Wallet mints your gift" },
          { brand: "Arc" as const, label: "Confirming the GiftToken on Arc" },
        ]
      : [
          { brand: "World" as const, label: "Checking you are a real, unique person" },
          { brand: "DYNEXA" as const, label: "The agent reviews your proof" },
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <div className="label">{isSelfie ? "Your selfie with the product" : "Photo of your receipt"}</div>
                {!isSelfie && (
                  <button
                    onClick={() => setUseLink((v) => !v)}
                    style={{ background: "none", border: "none", color: "var(--magenta)", fontSize: 11, cursor: "pointer" }}
                  >
                    {useLink ? "Use a photo instead" : "Paste a social link instead"}
                  </button>
                )}
              </div>

              {useLink && !isSelfie ? (
                <input
                  className="field"
                  value={socialLink}
                  onChange={(e) => setSocialLink(e.target.value)}
                  placeholder="https://instagram.com/p/..."
                />
              ) : photo ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={photo}
                    alt={isSelfie ? "Selfie" : "Receipt"}
                    style={{
                      width: "100%",
                      maxHeight: 220,
                      objectFit: "cover",
                      borderRadius: 13,
                      border: "1px solid rgba(255,255,255,0.09)",
                    }}
                  />
                  <button
                    className="btn-ghost"
                    style={{ position: "absolute", top: 8, right: 8, padding: "5px 10px", fontSize: 11 }}
                    onClick={() => setPhoto(null)}
                  >
                    Retake
                  </button>
                </div>
              ) : isSelfie ? (
                <SelfieCapture onCapture={setPhoto} onError={setPhotoError} />
              ) : (
                <label
                  className="field"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "26px 14px",
                    textAlign: "center",
                    cursor: "pointer",
                    color: "var(--muted)",
                  }}
                >
                  <span style={{ fontSize: 22 }}>📷</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    Take or upload a photo
                  </span>
                  <span style={{ fontSize: 11 }}>The agent reads it and checks it against the condition</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onPickPhoto}
                    style={{ display: "none" }}
                  />
                </label>
              )}
              {photoError && <p style={{ color: "#ff8a8a", fontSize: 12, marginTop: 6 }}>{photoError}</p>}
              {error && <ErrorNote message={error} />}
              <button
                className="btn-primary"
                style={{ marginTop: 14 }}
                disabled={busy || (!photo && !socialLink.trim())}
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
            ? "Not approved this time"
            : "Waiting for business approval"}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 12px" }}>
        {result.reason}
      </p>
      <TxLink hash={result.txHash} />
      <button className="btn-ghost" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>
        Done
      </button>
    </div>
  );
}
