# Demo persona

Fictional brand. Not a real company.

## Business — Helados Vacafría Premium ("Vacafría")

Ice cream brand. Uses DYNEXA to run a welcome campaign.

- Logo: brown / cyan / cream. Files in `apps/web/public/brand/vacafria/`.
- Wallet: Privy business wallet.

## Campaign — "Verified Human Welcome"

| Field | Value |
|---|---|
| Treasury | 500 USDC |
| Cash reward | 5 USDC |
| GiftToken | 1 × Helado de Pistacho (Pistachio Ice Cream) |
| Limit | one welcome reward per verified human |
| Per-tx limit | 5 USDC |
| Campaign total | 500 USDC |
| Above limit | rejected |

## Consumer — Mauricio

Signs in with email or Google, gets an embedded wallet, completes Selfie Check,
scans a receipt, receives 5 USDC + the Pistacho GiftToken, redeems it at the POS.

## Assets needed in repo

- `apps/web/public/brand/vacafria/logo.png` — the Vacafría logo
- `apps/web/public/brand/vacafria/pistacho.jpg` — the Pistachio Ice Cream photo
