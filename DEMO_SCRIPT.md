# Demo script — 4 minutes

Everything below is live right now on `realloyalty.dynexa.us` / `apirealloyalty.dynexa.us`.
Narration is in English (say it on camera). Notes in *italics* are for you, not to read aloud.

Record on a phone if possible — the selfie step needs a real front camera, and it looks
more natural than a desktop recording. Have the World App ready on any phone that has it
installed (see the World section below for the fallback if not).

---

## 0:00–0:20 — Hook

> "Loyalty rewards are broken. Paper coupons get lost, points expire, and businesses have
> no real control over what they're giving away. DYNEXA fixes that: real USDC and branded
> gifts, controlled by a smart contract, delivered to real people — no seed phrase, no crypto
> knowledge needed."

*Show the login screen (`realloyalty.dynexa.us`, Customer tab) while you say this.*

## 0:20–0:55 — Privy: onboarding without a wallet

> "I sign in with just my email — Privy creates my wallet automatically, on Arc, right now.
> No seed phrase, nothing to write down."

*Click "Continue with email or phone" → type email → enter the code → land on Home.
Point at the wallet address showing up under the balance card.*

## 0:55–1:40 — World: proving I'm a real, unique person

> "Before I can earn anything, DYNEXA needs to know I'm a real, unique person — not a bot
> farming the same reward from ten fake accounts. That's World."

*Tap "Verify you are a real person."*

**If a phone with the World App is available:** complete the real flow — scan/connect,
finish verification, show the "Human Verified" badge and the welcome gift appearing.

**If not:** show the screen up to "Connect your World ID" and the QR code, and say:

> "This hands off to World's app to confirm liveness — a real signed request, not a stub.
> Once verified, it can't be reused by a second account, and it unlocks my welcome gift."

*Cut to a moment where the account is already verified (badge + welcome gift in the Gifts
tab) so the reward payoff is still shown.*

## 1:40–2:30 — Arc: the agent pays, but never decides the amount

> "Now I claim a reward. I take a photo of my receipt — the agent, running on Arc, checks
> it with AI vision. The AI only says yes or no. The amount and the limits are fixed by the
> business, on-chain."

*Home → pick "FREE ICE CREAM VACA FRIA" (or similar receipt campaign) → Claim reward →
upload a real receipt photo → Submit. Let the loader run (World → DYNEXA → Circle → Arc
steps) → show the paid result with the real tx hash link to ArcScan.*

> "That's a live Circle Agent Wallet paying USDC on Arc — verified contract, real
> transaction."

*Click the tx link, show it resolving on ArcScan.*

**Bonus, if time allows:** submit one claim you know will fail (wrong amount/mismatched
item) to show the specific rejection reason — "The invoice total is X Bs, below the Y Bs
required" — proving the AI and the policy engine actually check something, not just approve
everything.

## 2:30–3:05 — GiftTokens and P2P: real ownership, real sharing

> "Rewards aren't only cash. This is a GiftToken — an NFT redeemable at the point of sale."

*Gifts tab → flip a gift card → show the QR + code → mention "Gift this" if transferable.*

> "And if I just want to send a friend USDC directly, I can — no wallet required on their
> end. If they're already on DYNEXA it lands instantly; otherwise they get a link."

*Balance card → "Send to a friend" → send a small amount → show the result (direct delivery
or link + WhatsApp share).*

## 3:05–3:40 — The business side: control, not trust

> "On the business side, every campaign has a hard on-chain budget and per-transaction
> limit. The dashboard shows the real balance, not just an internal counter — and there's a
> kill switch that stops every automatic payout platform-wide, instantly."

*Switch to Business tab → show a campaign card (balance, NO FUNDS badge if any) → open
History tab, point at a real tx link → toggle the kill switch on/off.*

## 3:40–4:00 — Close

> "Privy for seedless onboarding, Arc for enforced, verifiable limits, World for real human
> uniqueness — three independent controls stacked so no single point can be gamed. That's
> DYNEXA. Real people, real loyalty."

*End on the DYNEXA logo / home screen.*

---

## Fallback order if something breaks live

1. World App unavailable on your device → use the QR-code moment (see 0:55–1:40) and
   cut to an already-verified account for the payoff.
2. AI vision claim is slow (~10–15s) → keep talking through the loader, it's expected.
3. Campaign out of funds → fund it from the Business tab first (see `docs/DEPLOYMENTS.md`
   for which campaigns currently have balance) or use a different one.

## Campaigns ready for the video (as of writing)

| Campaign | Type | Reward | Balance |
|---|---|---|---|
| FREE ICE CREAM VACA FRIA | receipt | 1.3 USDC | 10 USDC |
| 2USDCS for ever COKE you buy | receipt | 2 USDC | 3 USDC |
| Selfie con tu Pistacho | selfie | 1 USDC | 2 USDC |
| Trae un amigo a Vaca Fría | referral | 1 USDC (×2) | 4 USDC |

Check current balances before recording — claims made during rehearsal spend real (testnet)
USDC. Top up from Business → Fund if any are low.
