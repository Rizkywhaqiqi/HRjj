# JOJO HR Space

Fondasi Sistem HR Internal JOJO GROUP dengan Next.js App Router, TypeScript, Tailwind CSS, dan MySQL.

## Persiapan lokal

1. Gunakan Node.js 20.9 atau lebih baru (diuji pada Node 24) dan MySQL 8.0.16+ atau MariaDB 10.2.1+ (diuji pada MySQL 8.4.3).
2. Instal dependency:

   ```powershell
   npm install
   ```

3. Buat `.env` lokal berisi secret acak (perintah ini menolak menimpa `.env` yang sudah ada):

   ```powershell
   npm run env:init
   ```

   Untuk produksi, isi `.env` dari secret manager. `FIELD_ENCRYPTION_KEY` dan `FIELD_HMAC_KEY` harus berbeda dan masing-masing berupa kunci base64 32 byte. Jangan commit `.env`.

4. Terapkan migrasi (membuat database bila belum ada), lalu seed data master:

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

5. Jalankan aplikasi:

   ```powershell
   npm run dev
   ```

Akun Super Admin awal dibuat dari `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` di `.env`, dan hanya jika email tersebut belum terdaftar. Password tidak dicetak ke log; baca nilainya dari `.env` lalu ganti setelah login pertama.

## Script

| Script | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` / `npm run start` | Build dan jalankan produksi |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` (wajib di CI) |
| `npm run lint` | ESLint |
| `npm run env:init` | Membuat `.env` lokal dengan secret acak |
| `npm run db:migrate` | Menjalankan migrasi bernomor yang belum diterapkan |
| `npm run db:seed` | Seed brand, CV, divisi, jabatan, exit reason, contract type, permission, role, feature flag, dan Super Admin |

## Migrasi database

- File migrasi berada di `database/migrations/` dan dijalankan berurutan berdasarkan nama file (`0001_`, `0002_`, dst). Riwayat dan checksum tercatat di tabel `schema_migrations`.
- Jangan mengubah migrasi yang sudah diterapkan; buat nomor baru. Runner memberi peringatan bila checksum berubah.
- `database/schema.sql` adalah snapshot DDL lengkap. Runner mendukung direktif `SOURCE <path>;`, sehingga `0001_initial.sql` tetap kompatibel dengan MySQL CLI maupun `npm run db:migrate`.
- Pada database kosong, runner menerapkan snapshot lalu mencatat baseline sampai `0010_notification_claim.sql` agar DDL pada snapshot tidak dijalankan ulang oleh migrasi lama. Migrasi setelah baseline tetap dijalankan berurutan. Jika snapshot diperbarui, selaraskan `SCHEMA_SNAPSHOT_VERSION` di `database/migrate.ts`.
- Database yang sudah berisi tabel tetapi belum memiliki riwayat migrasi ditolak; tentukan dan catat versi skemanya secara terkontrol sebelum menjalankan migrasi.
- `CREATE TABLE IF NOT EXISTS` tidak memutakhirkan tabel lama; gunakan migrasi baru untuk setiap perubahan skema. Constraint `fk_contract_letter` dipasang dengan guard agar snapshot bisa dijalankan ulang.

## Pemeriksaan wajib

`npm run typecheck`, `npm run lint`, dan `npm run build` harus hijau sebelum perubahan diserahkan. Pipeline yang sama berjalan di `.github/workflows/ci.yml` (service MySQL 8.4, migrasi, dan seed ikut diuji). Pemeriksaan TypeScript tidak boleh dimatikan di `next.config.ts`.

## Struktur singkat

- `src/app` → halaman dan Server Actions (App Router).
- `src/modules` → logika bisnis per fitur; hanya diekspos lewat `index.ts`.
- `src/core` → infrastruktur bersama (db, env, auth, rbac, crypto, audit); tidak boleh mengimpor `src/modules/*`.
- `src/types` → tipe database dan sesi.
- `database/` → skema, migrasi bernomor, seeder.
- `storage/private/` → file privat (KTP, CV) di luar `public/`.

## Catatan Next.js 16

- `middleware.ts` sudah deprecated dan diganti `proxy.ts`. Gate rute ditempatkan di `src/proxy.ts` dengan peran yang sama seperti middleware pada blueprint.
- Dengan `cacheComponents: true`, pembacaan sesi (cookies) pada rute terautentikasi memakai `export const instant = false` atau `<Suspense>`.

## Status

- **Fase 0** selesai dan terverifikasi: fondasi proyek, skema + migrasi bernomor, seeder, serta typecheck/lint/build.
- Fase 1 dan seterusnya mengikuti roadmap pada blueprint.
