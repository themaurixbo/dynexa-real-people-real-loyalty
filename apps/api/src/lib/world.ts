import { signRequest } from "@worldcoin/idkit-core/signing";
import { env } from "./env.js";

/**
 * World ID (Selfie Check). The backend signs the request with the RP signing
 * key and hands the signature to the IDKit widget; the widget returns a proof
 * that we POST back to World to verify, then we store the nullifier.
 */

export interface WorldSession {
  appId: string;
  action: string;
  environment: string;
  /** RpContext shape IDKit expects on the client */
  rpContext: {
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  };
}

export function createWorldSession(): WorldSession {
  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex: env.world.signingKey,
    action: env.world.action,
  });
  return {
    appId: env.world.appId,
    action: env.world.action,
    environment: env.world.env,
    rpContext: {
      rp_id: env.world.rpId,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      signature: sig,
    },
  };
}

export interface WorldVerifyResult {
  ok: boolean;
  nullifierHash?: string;
  error?: string;
}

export async function verifyWorldProof(payload: unknown): Promise<WorldVerifyResult> {
  const res = await fetch(`https://developer.world.org/api/v4/verify/${env.world.rpId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, error: String(body.detail ?? body.code ?? res.status) };
  }
  const p = payload as Record<string, unknown>;
  const first = Array.isArray(p.responses)
    ? (p.responses[0] as Record<string, unknown>)
    : undefined;
  const nullifierHash =
    (body.nullifier_hash as string) ??
    (body.nullifier as string) ??
    (p.nullifier_hash as string) ??
    (p.nullifier as string) ??
    (first?.nullifier as string);
  return { ok: true, nullifierHash };
}
