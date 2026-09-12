## OUR MOTIVATION AS LATINS ;)

We are excited to be here at ETHOnline 2026 because we believe our idea/ project  has what it takes to stand among the hackathon’s best. We are solving a problem that may seem simple, but is deeply frustrating and familiar to millions of people across Latin America.

In Latin America, we love giving and receiving gifts. Rewards create emotion, bring people closer to their favorite brands and make an ordinary purchase feel special. But today, receiving a reward often becomes a headache. We forget vouchers, lose paper coupons, fill our wallets with gift cards, discover that a benefit has expired, or collect points and miles for years without ever having enough for even a small gift.

That is why we are building DYNEXA: to make rewards easy to receive, impossible to lose and actually worth using.

DYNEXA is being built in Latin America, but this is a problem shared by people everywhere.

# Dynexa Real People, Real Loyalty
An AI-powered loyalty platform that enables businesses to deliver USDC and branded rewards to verified customers through secure, policy-controlled wallets.

## DYNEXA: Real Loyalty for Real People

DYNEXA helps businesses create loyalty campaigns funded with USDC. Customers can join with a familiar login, receive an embedded wallet, verify they are real people and earn useful rewards without dealing with seed phrases, gas or crypto complexity.

For ETHOnline 2026 we built DYNEXA from scratch with Privy, Arc and World. A
business funds a campaign, sets spending limits, and picks how customers prove
they qualify — a purchase receipt, a selfie with the product, or referring a
friend. AI evaluates the proof; a deterministic policy engine and the on-chain
contract decide whether it pays, never the AI. GiftTokens are redeemable at the
point of sale, and both USDC and GiftTokens can be sent peer-to-peer by link.

## What we built

- **Three ways to qualify**: purchase receipt (photo or a pasted social-post
  link), consumption selfie (live camera, not a file picker), and referrals
  (the referrer and the new customer both get paid, in two separate
  transactions).
- **AI proposes, the chain decides**: vision model checks the evidence and
  gives a specific reason either way ("the invoice total is X, below the Y
  required") — it never sets or approves an amount. An 8-check deterministic
  policy engine and the smart contract enforce the real limits.
- **Real human uniqueness**: World Selfie Check gates the welcome gift; the
  per-person limit is counted by the verified World identity, not by account,
  so a second sign-up can't dodge it.
- **Seedless wallets**: Privy creates an embedded wallet on Arc the moment a
  customer signs in with email or phone — no seed phrase, ever.
- **Business control**: real on-chain balance per campaign (not an internal
  counter), a "NO FUNDS" warning, a manual-approval queue for large claims, a
  full decision history with the real transaction link, and a kill switch that
  pauses every automatic payout platform-wide.
- **GiftTokens and P2P**: branded ERC-1155 gifts with a flip card, QR code and
  redemption at the point of sale; USDC or a GiftToken can be sent to a friend
  by link (WhatsApp-ready) or delivered straight to their wallet if they
  already use DYNEXA.

## Status

Live: **[realloyalty.dynexa.us](https://realloyalty.dynexa.us)** (frontend) ·
**apirealloyalty.dynexa.us** (backend). Contracts verified on ArcScan.

The live server runs the real Circle Agent Wallet (`AGENT_SIGNER=circle`), AI
vision verification, and real World Selfie Check — everything above is live,
not mocked. Tx hashes in [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md) and the
demo walkthrough in [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

Still connecting: the Privy **business** server wallet — the code and its
spending policy are built and deployed, but Privy's server wallets only
transact on a preset chain list that doesn't include Arc yet (see
[FEEDBACK_PRIVY.md](FEEDBACK_PRIVY.md)), so business-side funding uses a
direct key for now. The consumer side (embedded wallet, no seed phrase) is
fully live.

## Docs

- [DEMO_SCRIPT.md](DEMO_SCRIPT.md) — 4-minute walkthrough, what to click and say
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — working plan and cut order
- [SPIKES.md](SPIKES.md) — Arc / Privy / World research and open blockers
- [PREEXISTING_WORK.md](PREEXISTING_WORK.md) — greenfield compliance disclosure
- [docs/adr/0001-stack-and-structure.md](docs/adr/0001-stack-and-structure.md) — stack decisions

## Stack

TypeScript monorepo (pnpm). Next.js + Tailwind web, Node API, PostgreSQL +
Drizzle, Foundry contracts, viem. See the ADR for details.

Copy `.env.example` to `.env` before running anything.


