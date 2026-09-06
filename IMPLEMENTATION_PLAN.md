# Implementation plan

Authoritative spec: `DYNEXA — ETHOnline 2026 Greenfield MVP Specification` (19 sections).
This file is the working plan derived from it.

Deadline: Sunday Sept 13, 2026, 12:00pm EDT.
Partners: Privy, Arc, World.

## Rule

Every day ends with something that runs end to end, even if rough. Build the
vertical slice (login → verify → decide → pay → mint) before any dashboard, POS
polish or extra docs.

## Order of work

1. **Money rails.** DB schema + migrations. `CampaignTreasuryFactory` and
   `CampaignTreasury` (fund, per-tx limit, campaign-total limit, pause, close)
   with Foundry tests. Deploy to Arc testnet, verify on the explorer. Done when a
   script can fund a treasury and push one authorized payout, and an over-limit
   call is rejected.
2. **Identity rails.** Privy consumer login → embedded wallet. Privy business
   wallet + one real control (spending policy on the signer). World Selfie Check
   against Sandbox: backend RP signature, credential request, backend proof
   verification, nullifier stored, replay blocked.
3. **AI decision + full slice.** Agent takes structured input (campaign,
   customer, receipt, risk) and returns the spec JSON shape with reason codes.
   Deterministic policy engine validates the proposal against real campaign state
   before anything is signed. Wire: receipt fixture → AI proposes → policy
   validates → Privy signer authorizes → `CampaignTreasury.payout()` → GiftToken
   mint. Done when Use Case 3 and 4 work on testnet.
4. **Negative cases.** Duplicate World nullifier blocked and logged (UC5).
   50 USDC proposed against a 5 USDC policy, blocked at the Privy policy layer and
   the contract layer (UC6). Both must be recordable, not simulated.
5. **GiftToken + POS.** ERC-1155: mint on approved claim, redeem/burn,
   double-redemption blocked (UC7). Minimal POS screen: enter code → validate →
   redeem → reject on retry.
6. **Business dashboard.** Create campaign, set limits, fund, activate, see
   balance and a decisions list.
7. **Tests, docs, video.** Playwright for the 5 minimum flows. Required docs
   (see spec §14) written as work is done, not from memory. Record the 4-minute
   demo per the §16 script.

## Cut order if time runs short

1. P2 stretch items.
2. Playwright automation (keep manual proof + the demo video).
3. POS as a separate screen (fold redemption into the dashboard).
4. Dashboard charts (a plain decisions table is enough).

Never cut: the two negative-case demos.

## Blocked on account setup

Tracked in `SPIKES.md`. Needs: GitHub repo (done), Privy app, World Developer
Portal app with Sandbox, LLM API key, confirmed business persona.
