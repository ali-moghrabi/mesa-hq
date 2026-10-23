# MESA HQ

The private side of MESA: clients, subscriptions and payments. One Next.js app (pages + server),
its own MongoDB database, one owner login.

## Setup (once)

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `MONGODB_URI`: your Atlas cluster with the database name `mesa_hq`
   - `AUTH_SECRET`: `openssl rand -base64 48`
3. Create your account (the password is typed hidden, twice):
   `npm run create-admin -- you@example.com "Your Name"`
4. `npm run dev` and open http://localhost:3100

Run the same command again to reset a password. That also signs that account out everywhere.

## How sign-in works

- **Token:** sign in → a JWT (HS256, signed with `AUTH_SECRET`) valid for **7 days**, in an httpOnly,
  Secure, SameSite=Lax cookie (`hq_session`). There's no refresh token: after 7 days you sign in again.
- **First check (`proxy.ts`):** no valid token → `/sign-in`.
- **Real check (`requireAdmin()` in `lib/auth/session.ts`):** every protected page and server action
  checks the token **and** the database. The account must exist and be active, with the same role and
  token version.
  - `requireAdmin()`: any admin
  - `requireAdmin(["owner"])`: only these roles
- **Ending sessions:** "Sign out everywhere" and password resets raise `tokenVersion`, which ends every
  existing token at once.
- **Passwords:** scrypt hashes, never stored in plain text.
- **Guessing:** 5 wrong tries per email, or 20 per network, within 15 minutes block further tries for a
  while (stored in MongoDB, so it works on Vercel).
- **No accounts leak:** an unknown email and a wrong password get the same answer, in the same time.

## Deploy (Vercel)

New project from this repo. Add `MONGODB_URI` and `AUTH_SECRET` as environment variables, deploy,
then add a domain such as `hq.mesa-template.store`. Run `create-admin` once from your computer
against the same database.
