"use client";

import { useCallback, useEffect, useState } from "react";
import { IDKitRequestWidget, selfieCheckLegacy } from "@worldcoin/idkit";
import { api } from "../lib/api";
import { Partner } from "./ui";
import { TrackLoader } from "./loader";

/**
 * World Selfie Check. Shown until the user is verified; after that the caller
 * renders the "Human Verified" state. Verification is one-time.
 */
export function WorldVerify({
  contact,
  wallet,
  onVerified,
}: {
  contact: string;
  wallet: string;
  onVerified: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Awaited<ReturnType<typeof api.worldSession>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const start = useCallback(async () => {
    setErr(null);
    try {
      setSession(await api.worldSession());
      setOpen(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="btn-ghost" onClick={start}>
          Verify you are a real person
        </button>
        <Partner name="World" />
      </div>
      {err && <span style={{ color: "#ff8a8a", fontSize: 12 }}>{err}</span>}

      {session && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={session.appId as `app_${string}`}
          action={session.action}
          rp_context={session.rpContext}
          allow_legacy_proofs={false}
          environment={session.environment as "staging" | "production" | "sandbox"}
          preset={selfieCheckLegacy({ signal: wallet })}
          onSuccess={async (result) => {
            setChecking(true);
            try {
              const r = await api.worldVerify(contact, wallet, result);
              if (r.verified) onVerified();
              else setErr(r.error ?? "verification failed");
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setChecking(false);
            }
          }}
          onError={(e) => setErr(String((e as unknown as { code?: string })?.code ?? e))}
        />
      )}

      {checking && (
        <TrackLoader
          title="World Selfie Check"
          steps={[
            { brand: "World", label: "Verifying your proof of personhood" },
            { brand: "World", label: "Making sure this person hasn't claimed before" },
          ]}
        />
      )}
    </div>
  );
}

/** poll status so the pill flips after verification elsewhere */
export function useWorldStatus(wallet?: string) {
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    if (!wallet) return;
    api
      .worldStatus(wallet)
      .then((r) => setVerified(r.verified))
      .catch(() => {});
  }, [wallet]);
  return { verified, setVerified };
}
