# Feedback — World

Based on integrating World ID / Selfie Check into DYNEXA during ETHOnline 2026.

## Docs and integration flow

- The overall model (Developer Portal app → RP → action → backend signs the
  request → IDKit widget → backend verifies the proof → store the nullifier) is
  sound and maps well to a real anti-abuse use case.
- The `docs.world.org/world-id/SKILL` page is a good single reference, but the
  two-step CLI setup it points to ("fetch `setup.md`, then fetch
  `wallet-login.md`, and **do not follow the CLI output**") is unusual and easy
  to get wrong. A normal quickstart page with copy-paste steps would be clearer.
- Selfie Check being **Beta and gated by a per-app feature flag** is the biggest
  friction for a hackathon. We had to plan around not having it and keep an
  Incognito Actions fallback. A self-serve staging toggle in the Developer Portal
  would let teams start immediately.

## Developer Portal navigation and product discovery

- The RP / signing-key setup was the confusing part. Our app ended up configured
  with a **signer address** rather than a generated key, and it was not obvious
  that the RP **signing key private key is only shown once at creation** — if you
  didn't capture it, you must **rotate** to get a usable key, and the rotate
  action isn't prominent.
- It's unclear from the portal which value is which: `app_id`, `rp_id`,
  `signing_key.private_key`, and the signer address all look similar and the
  portal doesn't label where each one is used (client vs backend, public vs
  secret).
- The Developer Portal **API key** vs the **RP signing key** are different things
  used for different purposes (portal management API vs signing RP requests) and
  the naming doesn't make that obvious.

## Sandbox, proof flows, test users, errors

- Using the **staging** action with the World ID Simulator for development is the
  right call, but the docs on how the simulator produces test proofs, what test
  users exist, and how to force error/edge states are thin.
- The environment match requirement (client env vs action env) is a common
  footgun — it deserves a callout with the exact error message it produces.
- Error responses from the verify endpoint could be more descriptive about
  *why* a proof failed (expired, wrong action, wrong environment, replay).

## Debugging experience

- Once the pieces are in place it works, but getting there is trial and error
  because the signing-key model, the environment match, and the feature flag all
  fail in ways that look similar (a proof that just doesn't verify).

## Concrete suggestions

1. A single "World ID quickstart" page: create app → create action (staging) →
   copy `app_id` / `rp_id` / signing key → backend sign snippet → IDKit snippet →
   verify snippet → store nullifier. One page, copy-paste.
2. Make the signing key downloadable again from the portal (or make "rotate" a
   first-class, obvious button) and clearly label it "backend secret, shown once".
3. Self-serve Selfie Check on staging without a feature-flag request.
4. Clearer sandbox docs: test users, how to trigger each error state, exactly
   what a staging proof looks like.
