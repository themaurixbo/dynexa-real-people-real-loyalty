## OUR MOTIVATION AS LATINS ;)

We are excited to be here at ETHOnline 2026 because we believe our idea/ project  has what it takes to stand among the hackathon’s best. We are solving a problem that may seem simple, but is deeply frustrating and familiar to millions of people across Latin America.

In Latin America, we love giving and receiving gifts. Rewards create emotion, bring people closer to their favorite brands and make an ordinary purchase feel special. But today, receiving a reward often becomes a headache. We forget vouchers, lose paper coupons, fill our wallets with gift cards, discover that a benefit has expired, or collect points and miles for years without ever having enough for even a small gift.

That is why we are building DYNEXA: to make rewards easy to receive, impossible to lose and actually worth using.

DYNEXA is being built in Latin America, but this is a problem shared by people everywhere.

# Dynexa Real People, Real Loyalty
An AI-powered loyalty platform that enables businesses to deliver USDC and branded rewards to verified customers through secure, policy-controlled wallets.

## DYNEXA: Real Loyalty for Real People

DYNEXA helps businesses create loyalty campaigns funded with USDC. Customers can join with a familiar login, receive an embedded wallet, verify they are real people and earn useful rewards without dealing with seed phrases, gas or crypto complexity.

For ETHOnline 2026, we are building DYNEXA from scratch with Privy, Arc and World. The MVP will let a business fund a campaign, set spending limits and use AI to evaluate purchases before delivering USDC and branded GiftTokens. It will also prevent duplicate claims, block unauthorized payments and support GiftToken redemption at the point of sale.

## Development Plan

We will start with the core payment flow: creating the business and customer wallets with Privy and sending a real USDC reward on Arc testnet. We are doing this first because the rest of the product depends on having a secure and reliable way to move rewards.

Once that works, we will add World Selfie Check to confirm that a real person is claiming the reward. Then we will connect the AI agent, which will review the purchase and campaign rules before proposing how much the customer should receive. The final decision will always pass through fixed spending limits before any payment is made.

Next, we will add the branded GiftToken, the POS redemption flow and the business dashboard. The dashboard will show the campaign budget, rewards delivered, blocked claims and onchain transactions.

Finally, we will test the complete journey, including duplicate claims, excessive payments and repeated redemptions. Our demo will focus on one clear flow: a business funds a campaign, a verified customer completes a purchase, the AI approves the reward and DYNEXA delivers real value while keeping the business in control.

## Status

Day 1. Compliance and planning docs in place, integration spikes done. Next: DB
schema and the campaign treasury contracts on Arc testnet.

## Docs

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — working plan and cut order
- [SPIKES.md](SPIKES.md) — Arc / Privy / World research and open blockers
- [PREEXISTING_WORK.md](PREEXISTING_WORK.md) — greenfield compliance disclosure
- [docs/adr/0001-stack-and-structure.md](docs/adr/0001-stack-and-structure.md) — stack decisions

## Stack

TypeScript monorepo (pnpm). Next.js + Tailwind web, Node API, PostgreSQL +
Drizzle, Foundry contracts, viem. See the ADR for details.

Copy `.env.example` to `.env` before running anything.


