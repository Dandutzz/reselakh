# Reselakh

Platform sewa bot auto order Telegram & WhatsApp untuk produk digital. Dibangun
dengan Next.js 16 (App Router + Turbopack), Prisma 7 + SQLite, dan auth JWT
custom.

## Fitur

- Multi-tenant: setiap user punya kategori, produk, variasi, stock, dan bot
  sendiri.
- Auto-order via Telegram (Grammy) dan WhatsApp (Baileys) — stock diklaim
  secara atomik di dalam transaksi sehingga tidak bisa terjual ganda.
- Saldo, mutasi, withdraw, voucher.
- Panel admin: kelola user, voucher, withdrawal, QRIS, mutasi, dan resellers.

## Persyaratan

- Node.js ≥ 20.9.0 (Next.js 16 minimum)
- npm 10+ (atau pnpm/yarn yang setara)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template & isi NEXTAUTH_SECRET dengan string acak panjang
cp .env.example .env
# Edit .env — minimal NEXTAUTH_SECRET wajib di-set, kalau tidak server tidak mau start.

# 3. Migrasi & seed database
npx prisma migrate dev
npx prisma db seed   # opsional: bikin admin/demo user

# 4. Jalankan dev server
npm run dev
```

Buka <http://localhost:3000>.

## Default seed credentials (HANYA UNTUK DEV)

Seed script membuat dua akun:

| Username | Email                | Password   | Role  |
| -------- | -------------------- | ---------- | ----- |
| `admin`  | `admin@reselakh.com` | `admin123` | admin |
| `demo`   | `demo@reselakh.com`  | `demo123`  | user  |

> **Wajib ganti password admin sebelum deploy ke production.** Seed credentials
> di atas dimaksudkan hanya untuk pengujian lokal. Dipisahkan ke akun terpisah
> dan dengan password kuat di production.

## Environment variables

| Variable               | Wajib | Keterangan                                                         |
| ---------------------- | ----- | ------------------------------------------------------------------ |
| `DATABASE_URL`         | ya    | URL Prisma datasource. Default `file:./dev.db` (SQLite).            |
| `NEXTAUTH_SECRET`      | ya    | Secret untuk signing JWT. Server tidak mau start kalau kosong.     |
| `NEXT_PUBLIC_SITE_URL` | tidak | URL canonical untuk metadata SEO/OpenGraph. Opsional di dev.        |

## Skrip

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run start      # start hasil build
npm run lint       # ESLint
```

## Skema arsitektur

- **Auth** — `src/lib/auth.ts`: bcrypt + JWT dengan TTL 1 hari, tersimpan di
  cookie `auth-token` (`httpOnly`, `secure` di production, `sameSite=lax`).
- **Validasi input** — `src/lib/validate.ts`: helper `parseJson(request, schema)`
  yang lempar `ValidationError` (HTTP 400) bila body tidak match Zod schema.
- **Rate limit** — `src/lib/rateLimit.ts`: token bucket in-memory, dipakai pada
  `/api/auth/login`, `/api/auth/register`, dan `/api/user/vouchers`. **Catatan:**
  in-memory state tidak survive di environment multi-instance/serverless;
  ganti ke Redis (e.g. `@upstash/ratelimit`) untuk production scale.
- **Bot order pipeline** — `src/lib/order.ts`: `placeBotOrder()` mengklaim
  stock secara atomik via `updateMany(... isSold: false)` di dalam transaksi.
- **Proxy/middleware** — `src/proxy.ts`: optimistic auth gate untuk path
  `/panel/*` dan `/admin/*`. Authorization yang sebenarnya tetap dilakukan
  di tiap route handler (`requireAuth`/`requireAdmin`).
- **Cross-tenant safety** — semua endpoint `/api/user/*` memvalidasi
  ownership melalui Prisma relation filter (`where: { id, product: { userId } }`),
  sehingga user A tidak bisa membaca/mengubah resource user B.

## Catatan deployment

- Bot Telegram & WhatsApp dijalankan dalam-process; jangan deploy ke
  serverless. Pakai container/VM yang stateful (Fly.io, Railway, VPS, dsb).
  Kalau memang harus serverless, refactor agar bot worker terpisah.
- Stock berisi data akun dalam **plaintext**. Pertimbangkan enkripsi di
  layer aplikasi (AES-GCM) sebelum disimpan, dengan key dari KMS/secret store.
- SQLite oke untuk dev — untuk production, ganti ke Postgres dan jalankan
  `prisma migrate deploy`.

## Status keamanan known issues

Lihat history PR untuk daftar perbaikan terbaru. Item yang masih open / butuh
follow-up:

- Plaintext stock data (advisory): perlu enkripsi at-rest.
- Bot in-memory state (advisory): perlu pindah ke worker terpisah jika
  deployment serverless.
- Backup S3 (`/api/admin/backup` dengan `action=run_backup`): masih stub,
  belum mengimplementasikan dump SQLite + upload S3.
