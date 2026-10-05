# Payments — current state and how to finish going live

This documents exactly what's real, what's not, and the exact remaining
steps — so this doesn't have to be re-derived from chat history later.

## The three-way switch

`apps/api/src/payments/razorpay.provider.ts` picks a client based on which
env vars are set, and it's already deployed — no code changes needed for
any of the states below, just env vars + one dashboard step.

| State | Env vars set | Top-ups (money in) | Payouts (money out) |
|---|---|---|---|
| Full mock | none | fake | fake |
| **Current: hybrid** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | **real** | **manual** (admin pays by hand, confirms in dashboard) |
| Full live | + `RAZORPAYX_ACCOUNT_NUMBER` | real | **real** (automated via RazorpayX) |

We are in the **hybrid** row right now, in production.

## What's actually live today

- Renters can top up their wallet via real Razorpay Checkout (`apps/dashboard/app/(app)/wallet/page.tsx`).
- Depositor payouts show up in the admin's **"Needs manual payout"** queue
  (`apps/dashboard/app/PendingPayouts.tsx`) — pay the UPI ID shown, by hand,
  from your own UPI app, then click "Mark paid".
- `RAZORPAY_WEBHOOK_SECRET` is set on the API (Vercel), so `/webhooks/razorpay`
  will correctly verify a real signed webhook and reject forged ones.

## ⚠️ One step that's still genuinely missing

Having the secret set on **our** side isn't the same as Razorpay actually
**sending** the webhook. That requires registering it in Razorpay's own
dashboard, and this was never done — we got pulled into the RazorpayX/OPC
detour before circling back. Until this is done, a renter who *actually
completes* a real payment will be charged, but their wallet **will not be
credited**, because nothing tells our server the payment succeeded.

**Do this now, before anyone completes a real top-up:**

1. Go to your Razorpay dashboard → **Settings → Webhooks** (or search
   "Webhooks" in the dashboard search bar).
2. Click **Add New Webhook**.
3. **Webhook URL**: `https://api.cycoil.in/webhooks/razorpay`
4. **Active events**: check `payment.captured` (that's the only one this
   endpoint listens for).
5. **Secret**: this is the part that has to match exactly what's already set
   on our side. Ask me for the current value of `RAZORPAY_WEBHOOK_SECRET`
   and paste it in here — don't generate a new one in Razorpay's UI, since
   the two sides have to agree on the same secret for signatures to verify.
6. Save.

That's it — no redeploy needed, no code change. Once saved, real completed
payments will actually credit wallets.

## Going from hybrid → full live (automated payouts)

This needs **`RAZORPAYX_ACCOUNT_NUMBER`**, which depends on RazorpayX
approving your account — which (per the access-denied check we hit) needs a
registered proprietorship, not just a personal-PAN individual account.

Path to get there:
1. **Udyam (MSME) registration** — free, instant, self-declared, at
   udyamregistration.gov.in.
2. **Shop & Establishment registration** — Rajasthan, ₹5,000 one-time
   government fee (0–10 employee bracket), via the state's LDMS portal.
3. Add both as entity documents in Razorpay's business-details section.
4. Re-apply for RazorpayX (Banking+) from the Razorpay dashboard.
5. Once approved, you'll get an account number. Hand it to me and I'll:
   - Set `RAZORPAYX_ACCOUNT_NUMBER` on the API (Vercel).
   - Register the second webhook (`https://api.cycoil.in/webhooks/razorpayx`,
     events `payout.processed` / `payout.failed`) the same way as above.
   - Redeploy. The provider switches to fully-real automatically — no other
     code changes.

## One real caveat, not just a formality

The UPI fund-account resolution code (`real-razorpay.client.ts` —
`resolveFundAccount`/`createContact`/`createFundAccount`) is written against
Razorpay's documented Contacts/Fund Accounts APIs but has **never been
exercised against a live account**, because no RazorpayX account has existed
to test it against. The first few real payouts after going fully live should
be watched closely (small amounts first) rather than trusted blind.

## Optional future upgrade: let the depositor choose how they're paid

Right now a depositor's UPI ID is collected once, at kiosk pairing, and every
payout pushes money there automatically. **RazorpayX Payout Links**
([docs](https://razorpay.com/docs/x/payout-links/)) is a different RazorpayX
product that flips this: you create a link with just the recipient's name +
phone + amount, they open it, verify by OTP on their own phone, and *then*
choose UPI or bank account and enter whichever ID they want — the choice
happens at claim time, not upfront.

This is genuinely a separate, later step, not part of the base "go live"
path above:

1. **Same RazorpayX account is required first** — this is a product inside
   RazorpayX, not a standalone thing.
2. **IP allowlisting is mandatory for the API** (not required if links are
   created manually from Razorpay's own dashboard — only for code calling
   the API). Vercel serverless functions don't have a fixed outbound IP by
   default, so this needs a static-IP solution in front of the API call
   before it's worth writing any integration code — otherwise Razorpay will
   reject every request.
3. **Shape of the integration**, once the above is solved: after an accepted
   deposit, call the Payout Links create API with the depositor's phone +
   `amountPaise` (kept from the existing kiosk pairing step — no change
   there), get back a `short_url`, render it as a QR code on the kiosk's
   "paid" screen (e.g. via the `qrcode` npm package — Razorpay doesn't
   generate the QR image itself, just the link), and let the depositor scan
   it with a normal camera app. The existing manual-payout admin queue stays
   as the fallback for anyone who doesn't claim it.

Don't build this before the static-IP problem has an actual answer — it's
the part that'll silently block every API call otherwise.
