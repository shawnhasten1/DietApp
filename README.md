# Diet App

Invite-only nutrition and fitness tracking web app (household-focused, mobile-first).

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Prisma + Neon Postgres
- Auth.js (`next-auth`) with Google OAuth + email/password
- Edamam nutrition provider (with swappable provider abstraction)

## Implemented v1 Foundation

- Invite-only auth gating for both Google and credentials sign-in
- User-owned profile/goals
- Manual + provider-assisted food logging
- Exercise logging
- Weight logging
- Daily summary (consumed, burned, net, macros)
- Chart-ready weight history endpoint

### Main Routes

- `/dashboard`
- `/profile`
- `/food`
- `/exercise`
- `/weight`
- `/login`
- `/signup`

### API Routes

- `/api/auth/[...nextauth]`
- `/api/auth/signup`
- `/api/nutrition/search`
- `/api/nutrition/upc/[upc]`
- `/api/weight/history`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`.

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Apply migrations:

```bash
npm run prisma:migrate
```

5. Add household allowlisted emails:

```bash
npm run allowlist -- add you@example.com
```

6. Start dev server:

```bash
npm run dev
```

## Environment Variables

Required:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `EDAMAM_APPID`
- `EDAMAM_APIKEY`

Optional:

- `NUTRITION_PROVIDER` (`edamam` default)

## Deployment Notes (Vercel)

1. Add all environment variables in Vercel Project Settings.
2. In Google Cloud OAuth credentials, set redirect URI:
   - `https://<your-domain>/api/auth/callback/google`
3. Set `NEXTAUTH_URL` to your production domain.
4. Run migrations against production database before first sign-in.

## Security And Behavior Checks

- Allowlisted email can sign up and sign in.
- Non-allowlisted email cannot sign in.
- Users only see their own food/exercise/weight/profile data.
- Nutrition provider failures still allow manual food entry.
- Net calories compute as `consumed - burned`.

## Useful Commands

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run prisma:studio`
- `npm run allowlist -- list`
