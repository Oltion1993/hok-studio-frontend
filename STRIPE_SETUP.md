# 🔑 HOK Studio — Stripe Setup Guide
## Hap pas hapi (15 minuta)

---

## HAPI 1 — Krijo Stripe Account
1. Shko te **stripe.com** → Sign up (ose login)
2. Aktivizo llogarinë me email

---

## HAPI 2 — Merr API Keys
1. **Stripe Dashboard** → **Developers** → **API Keys**
2. Kopjo:
   - `Publishable key` → `pk_live_...` (frontend, nuk nevojitet tani)
   - `Secret key` → `sk_live_...` ← **KY DUHET NË RAILWAY**
3. Për testim, kliko "View test data" dhe merr `sk_test_...`

---

## HAPI 3 — Krijo Produktet dhe Çmimet

### Në Stripe Dashboard → **Products** → "Add product":

**Produkt 1 — Starter Pack**
- Name: `HOK Studio Starter Pack`
- Price: `$9.99` → One time
- Kliko "Add product" → kopjo `Price ID` (format: `price_xxx`)

**Produkt 2 — Pro Pack**
- Name: `HOK Studio Pro Pack`  
- Price: `$24.99` → One time
- Kopjo Price ID

**Produkt 3 — Studio Pack**
- Name: `HOK Studio Studio Pack`
- Price: `$69.99` → One time
- Kopjo Price ID

---

## HAPI 4 — Konfiguro Webhook

1. **Stripe Dashboard** → **Developers** → **Webhooks**
2. Kliko **"Add endpoint"**
3. Endpoint URL: `https://hok-studio-backend-production.up.railway.app/api/stripe/webhook`
4. Events to listen:
   - ✅ `checkout.session.completed`
5. Kliko **"Add endpoint"**
6. Kliko endpoint-in → **"Signing secret"** → **Reveal** → Kopjo `whsec_...`

---

## HAPI 5 — Shto Variables në Railway

Shko te **Railway Dashboard** → **hok-studio-backend** → **Variables** → Shto:

```
STRIPE_SECRET_KEY=sk_live_XXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXX
STRIPE_PRICE_STARTER=price_XXXXX
STRIPE_PRICE_PRO=price_XXXXX
STRIPE_PRICE_STUDIO=price_XXXXX
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXXX
```

> **SUPABASE_SERVICE_ROLE_KEY** → Supabase Dashboard → Settings → API → service_role key

---

## HAPI 6 — Shto SQL në Supabase

1. **Supabase Dashboard** → **SQL Editor**
2. Kopjo të gjithë kodin nga `supabase_credits.sql`
3. Ekzekuto

---

## HAPI 7 — Deploy në Railway

```bash
# Shto dependency-t e reja
npm install stripe @supabase/supabase-js

# Commit dhe push
git add .
git commit -m "Add Stripe payments + auth middleware"
git push
```

Railway do të redeploy automatikisht.

---

## HAPI 8 — Testim

### Me Stripe Test Mode:
- Kartë testimi: `4242 4242 4242 4242`
- Expiry: çdo datë e ardhshme (p.sh. `12/28`)
- CVC: `123`

### Testi i plotë:
1. ✅ Regjistrohu në hokstudio.app
2. ✅ Kliko "Buy Starter" ($9.99)
3. ✅ Shtypni kartën e testimit
4. ✅ Vërehet ridrejtimi tek hokstudio.app?payment=success
5. ✅ Shiko nëse +500 credits u shtuan

---

## 🚨 Problem i njohur — DNS/SSL

Nga screenshots: `hokstudio.app` ka "DNS propagating" dhe **nuk ka SSL** ende.

**Zgjidha:**
- Prit 24-48 orë për DNS propagation
- Ose në Netlify → Domain Management → kliko **"Verify DNS configuration"**
- Pastaj **"Provision certificate"** nën HTTPS

Deri atëherë, përdor: `https://hok-studio.netlify.app` si URL alternative.

---

## Kredit Costs Reference

| Tipi | Model | Credits |
|------|-------|---------|
| 🖼️ Image | Flux/SDXL | 10-16 |
| 🎬 Video | Runway Gen-4 | 200 |
| 🎬 Video | Kling | 160 |
| 🔊 Audio | ElevenLabs v2 | 40 |
| 🔊 Audio | ElevenLabs v3 | 50 |
| 👤 Character | Flux | 12 |
