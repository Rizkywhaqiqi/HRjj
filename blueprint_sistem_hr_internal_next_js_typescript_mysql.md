# BLUEPRINT & ATURAN TEKNIS: SISTEM HR INTERNAL, RECRUITMENT & PROFIL PERUSAHAAN

> **Instruksi untuk AI Code Assistant:**
> Dokumen ini adalah *Single Source of Truth* untuk arsitektur, skema database, aturan bisnis, dan standar koding proyek ini. Patuhi seluruh batasan *tech stack*, nama tabel/kolom SQL, serta kerjakan fitur secara bertahap sesuai fase yang diminta pengguna.

## 1. TECH STACK & BATASAN ARSITEKTUR (WAJIB DIPATUHI)

1. **Framework:** Next.js (App Router) menggunakan **TypeScript (`.ts` / `.tsx`)**.
   * Gunakan tipe data yang ketat (*strict typing*) dengan memanfaatkan *interface* dari `src/types/database.ts` dan skema validasi `zod`.
   * **Dilarang** mengaktifkan `typescript.ignoreBuildErrors` pada `next.config.ts`. `npm run typecheck` wajib dijalankan sebelum build/deploy dan menjadi pemeriksaan wajib di CI. Jika keterbatasan RAM hosting menghambat build, optimalkan proses build atau gunakan pipeline CI; jangan menonaktifkan pemeriksaan tipe.

2. **Database:** MySQL 8.0.16+ atau MariaDB 10.2.1+ yang telah diverifikasi kompatibilitas DDL-nya, menggunakan driver **`mysql2/promise`**.
   * **DILARANG** menggunakan Prisma, Drizzle, Sequelize, atau ORM lainnya.
   * Seluruh query wajib menggunakan *prepared statements* (`db.execute<T>(sql, [params])`) untuk mencegah SQL Injection.
   * Gunakan `connectionLimit: 10` pada pool `mysql2` agar aman terhadap limit koneksi *shared*/*cloud hosting* (Hostinger).

3. **Styling & UI:** Gunakan **Tailwind CSS sebagai satu-satunya sistem styling** dan `lucide-react` untuk ikon. Terapkan class utility Tailwind langsung pada komponen; jangan menambahkan framework styling lain atau CSS per-komponen, kecuali CSS global minimum yang diperlukan untuk reset, font, dan theme tokens. Antarmuka wajib responsif (*mobile-first*) untuk Admin Brand dan Supervisor di outlet, dengan pola komponen dan token visual yang konsisten.

4. **Validasi:** `zod` (skema validasi dan inferensi tipe `z.infer<typeof schema>` yang sama dipakai di sisi form *client* maupun *Server Actions*).

5. **Autentikasi & Keamanan:**
   * Password di-hash menggunakan `bcryptjs` (salt rounds `12`).
   * Sesi login menggunakan JWT (`jose`) yang disimpan di cookie `httpOnly`, `secure`, `sameSite: 'lax'`.
   * Pisahkan cookie sesi **Staf Internal** (`hr_session`) dengan cookie sesi **Pelamar/Kandidat** (`candidate_session`).
   * Setiap sesi memeriksa status akun dan versi sesi yang tersimpan di database; perubahan password, penonaktifan akun, atau pencabutan sesi menaikkan versi sesi agar JWT lama tidak lagi berlaku. Semua pemeriksaan otorisasi tetap dilakukan di server.
   * Enkripsi field sensitif karyawan (**NIK, NPWP, No. Rekening**) menggunakan modul bawaan Node.js `crypto` (**AES-256-GCM**), disertai kolom *blind index* (`nik_hash` HMAC-SHA256) untuk pengecekan duplikat tanpa membuka enkripsi. Simpan nonce, authentication tag, dan versi kunci bersama ciphertext dalam format berversi; gunakan kunci enkripsi dan kunci HMAC yang berbeda, berasal dari secret environment/secret manager, bukan source code atau database. Validasi panjang/format kunci saat startup, jangan tulis plaintext atau secret ke log, dan siapkan prosedur backup, rotasi kunci, serta re-enkripsi/re-index terkontrol.
   * Penyimpanan file privat (Foto KTP & CV) berada di luar folder `public/` (yaitu `./storage/private/`) dan hanya bisa diakses melalui endpoint terproteksi `GET /api/files/[type]/[id]` setelah memeriksa izin, brand scope, dan kepemilikan sesi kandidat bila relevan. Batasi ukuran dan jenis file, verifikasi konten/MIME (bukan ekstensi saja), gunakan nama acak yang dibuat server, cegah path traversal, dan kirim file dengan header aman serta tanpa cache publik. Jangan menerima path file dari pengguna sebagai otoritas akses.
   * Terapkan rate limit yang tetap konsisten lintas instance untuk login, registrasi, dan endpoint sensitif; penyimpanan rate limit dalam memori proses saja tidak memadai bila aplikasi berjalan lebih dari satu instance.
   * Data pribadi hanya dikumpulkan untuk tujuan yang dijelaskan kepada pengguna. Catat persetujuan secara eksplisit sebelum pengajuan lamaran, dokumentasikan versi pemberitahuan privasi, masa retensi, proses koreksi/penghapusan atau anonimisasi, serta akses dan ekspor data. Data yang wajib disimpan karena kewajiban hukum harus dibedakan dari data yang dapat dihapus.

## 2. STRUKTUR FOLDER PROYEK

```text
hr-internal-app/
├── .env
├── .env.example
├── package.json
├── tsconfig.json                  # Path alias "@/*" -> "./src/*"
├── next.config.ts                 # Konfigurasi Next.js (pemeriksaan TypeScript build tetap aktif)
├── database/
│   ├── schema.sql                 # DDL lengkap seluruh tabel MySQL
│   ├── migrations/                # Migrasi skema bernomor dan berurutan
│   └── seed.ts                    # Seeder master data, RBAC, & akun awal (via npx tsx)
├── storage/
│   ├── templates/letters/         # Template DOCX: sp.docx, skk.docx, kontrak.docx, nda.docx, masih-bekerja.docx
│   └── private/
│       ├── ktp/                   # Foto KTP karyawan (privat)
│       └── cv/                    # File CV pelamar & karyawan (privat)
└── src/
    ├── middleware.ts              # Proteksi route (hr), (recruitment), dan (public)/kandidat
    ├── types/
    │   └── database.ts            # Interface RowDataPacket, Enum, & tipe Session
    ├── app/
    │   ├── layout.tsx
    │   ├── (public)/              # Portal publik: Profil Perusahaan, Daftar Brand, Karir, & Portal Kandidat
    │   │   ├── page.tsx
    │   │   ├── karir/             # Daftar lowongan & detail lowongan
    │   │   └── kandidat/          # Login, Register, Lengkapi Profil/CV, & Status Lamaran Kandidat
    │   ├── (auth)/                # Login staf internal & ganti password
    │   │   └── login/
    │   ├── (recruitment)/         # Dashboard Recruitment (Kanban pelamar, interview, talent pool)
    │   ├── (hr)/                  # Aplikasi HR Internal
    │   │   ├── dashboard/
    │   │   ├── employees/
    │   │   ├── contracts/
    │   │   ├── letters/
    │   │   ├── reports/
    │   │   ├── master-data/
    │   │   └── settings/          # Users, Roles Matrix, Feature Flags, Audit Logs
    │   └── api/
    │       ├── cron/contract-reminder/route.ts
    │       └── files/[type]/[id]/route.ts
    ├── core/                      # Infrastruktur bersama (DILARANG import dari src/modules/*)
    │   ├── db.ts                  # Singleton mysql2 pool, queryRows<T>(), executeSql(), withTransaction<T>()
    │   ├── env.ts                 # Validasi environment variables
    │   ├── module-registry.ts     # Definisi menu, izin, ikon, & feature flag
    │   ├── auth/
    │   │   ├── session.ts
    │   │   ├── candidate-session.ts
    │   │   ├── password.ts
    │   │   └── rate-limit.ts
    │   ├── rbac/
    │   │   ├── permissions.ts
    │   │   ├── guard.ts           # requirePermission(), checkFeatureEnabled()
    │   │   ├── scope.ts           # applyBrandScope() untuk filter query SQL berdasarkan brand user
    │   │   └── field-mask.ts      # maskSensitiveFields()
    │   ├── crypto/
    │   │   └── field-encrypt.ts   # encryptField(), decryptField(), createBlindIndex()
    │   └── audit/
    │       └── log.ts             # logAudit()
    ├── modules/                   # Logika bisnis terisolasi per fitur
    │   ├── employees/             # index.ts, queries.ts, actions.ts, schema.ts, components/
    │   ├── contracts/
    │   ├── letters/
    │   ├── recruitment/
    │   ├── notifications/
    │   ├── checklists/
    │   ├── master-data/
    │   ├── users/
    │   ├── roles/
    │   └── audit/
    └── components/                # Komponen UI reusable (ui/, layout/, shared/)
```

**Aturan Dependensi:** `src/app` $\rightarrow$ `src/modules` $\rightarrow$ `src/core`. Antar modul hanya boleh berkomunikasi melalui fungsi yang diekspor di `src/modules/<nama-modul>/index.ts`.

## 3. STRUKTUR ORGANISASI & DATA MASTER

### 3.1 Relasi Brand $\rightarrow$ CV (`companies`) $\rightarrow$ Karyawan

Karyawan **hanya** menyimpan `company_id` (CV). Brand didapat dari relasi `companies.brand_id` untuk mencegah inkonsistensi data. Kop surat memakai identitas CV, sedangkan dashboard & laporan bisa dikelompokkan per Brand maupun per CV.

| Brand | Kode | Daftar CV (`companies`) |
| --- | --- | --- |
| **Jojo** | `JOJO` | CV Jojo Natura Sentosa, CV Muhi Rasa Sentosa |
| **JLY** | `JLY` | CV Rasa Manis Nusantara |
| **Guulak** | `GUULAK` | CV Hanara Boga Kuliner |
| **Ana** | `ANA` | CV Ana Bakery Indonesia |
| **Mutiara** | `MUTIARA` | CV Mutiara Anugerah Prima |

### 3.2 Relasi Divisi $\rightarrow$ Jabatan (`positions`) $\rightarrow$ Karyawan

Karyawan **hanya** menyimpan `position_id`. Divisi didapat dari relasi `positions.division_id`.

| Divisi | Daftar Jabatan (`positions`) |
| --- | --- |
| **Operasional** | Manager Operasional, Manager Area, Supervisor, Staff Outlet, Staff Middle, Baker, Barista, Kasir |
| **Gudang** | Kepala Gudang, Admin Gudang, Staff Gudang, Driver |
| **Dapur Produksi** | Admin Dapur, Staff Dapur |
| **Head Office** | Head Finance, Admin Jojo, Admin JLY, Admin Guulak, Admin Ana, Head Accounting, Admin Pajak, Head Purchasing, Admin Purchasing, Admin CS, Admin Stock, Admin Finance, Head HRD, Admin HRD, Legal Officer, Arsitek, IT Support, Admin Proyek, Trainer Barista, Maintenance |
| **Marketing** | Head Marketing, Marketing Brand, Desain Grafis, Content Creator, Social Media Specialist, Videografer/Fotografer |

**Aturan Form Karyawan:**
* Dropdown berantai (*cascading*): pilih **Brand** $\rightarrow$ memfilter pilihan **CV**; pilih **Divisi** $\rightarrow$ memfilter pilihan **Jabatan**.
* **Lama bekerja** dihitung otomatis secara dinamis dari `join_date` sampai hari ini (atau sampai `exit_date` jika nonaktif), **tidak** disimpan di kolom database.

## 4. ATURAN BISNIS INTI

### 4.1 Tiga Status Karyawan yang Terpisah

1. **Status Perkawinan (`marital_status`):** `SINGLE`, `MARRIED`, `DIVORCED` + `children_count` (dipakai untuk penentuan PTKP).
2. **Status Karyawan (`is_active`):** `TRUE` (Aktif) atau `FALSE` (Nonaktif).
   * Otomatis berubah menjadi `FALSE` ketika `exit_date` diisi.
   * **Data karyawan tidak pernah dihapus permanen (`DELETE`).** Sediakan alur koreksi/anonimisasi yang berizin bila diwajibkan kebijakan retensi, tanpa menghapus riwayat transaksi. Tidak ada aksi hard-delete karyawan; foreign key terkait karyawan harus menolak penghapusan, bukan menghapus riwayat secara cascade.
3. **Status Keluar (`exit_reason_id`):** Relasi ke tabel master `exit_reasons` dengan indikator warna & flag rehire:
   * `GREEN`: Resign baik-baik (serah terima selesai), Kontrak selesai & layak diperpanjang, Pensiun, PHK Efisiensi / Penutupan Cabang (*Boleh dipekerjakan kembali*).
   * `YELLOW`: Kontrak tidak diperpanjang, Resign tanpa pemberitahuan, Tidak lulus masa percobaan (*Dipertimbangkan*).
   * `RED`: Diberhentikan tidak hormat, PHK karena pelanggaran / SP3, Mangkir berkepanjangan (*Tidak disarankan*).
   * *Konsistensi Server:* Jika `is_active = TRUE`, `exit_date` dan `exit_reason_id` wajib `NULL`. Jika `is_active = FALSE`, keduanya wajib terisi.

### 4.2 Alur Recruitment (Wajib Akun Pelamar) $\rightarrow$ Karyawan

1. **Portal Kandidat (`(public)/kandidat`):**
   * Pelamar **wajib mendaftar akun (`candidate_accounts`) dan login** sebelum melengkapi profil kandidat (`candidates`: NIK, pendidikan, alamat, upload CV PDF) dan melamar lowongan (`applications`).
   * Tampilkan pemberitahuan privasi dan tujuan pemrosesan; lamaran hanya dapat dikirim setelah kandidat memberi persetujuan eksplisit. Simpan waktu dan versi pemberitahuan yang disetujui. Pendaftaran akun saja tidak dianggap sebagai persetujuan lamaran.
   * `applications.consent_given` adalah bukti persetujuan saat lamaran dibuat dan tidak boleh diubah; penarikan persetujuan dicatat terpisah melalui `consent_withdrawn_at` dan diproses sesuai kebijakan retensi.
   * Melindungi portal publik dari spam sekaligus memungkinkan kandidat memantau status lamarannya (*Applied* $\rightarrow$ *Screening* $\rightarrow$ *Interview HR* $\rightarrow$ *Interview User* $\rightarrow$ *Tes* $\rightarrow$ *Offering* $\rightarrow$ *Accepted / Rejected*).
2. **Deteksi Mantan Karyawan & Duplikat (`checkRehire`):**
   * Saat kandidat melamar atau dibuka oleh Recruiter/HR, sistem mencocokkan `email`, `phone`, dan `nik_hash` dengan tabel `employees`.
   * Jika cocok dengan mantan karyawan, tampilkan banner peringatan sesuai warna `exit_reasons.severity` (`GREEN` / `YELLOW` / `RED`) beserta teks alasannya.
3. **Konversi Satu Klik (`hireCandidate`):**
   * Pada pelamar berstatus `ACCEPTED`, pengguna dengan izin `recruitment.hire` dapat menekan tombol **"Jadikan Karyawan"**.
   * Membuka form karyawan yang sudah terisi otomatis dari data lamaran (`full_name`, `email`, `phone`, `nik`, `company_id`, `position_id`, `location_id`, `cv_file_path`, `join_date`).
   * Saat disimpan, dalam **satu transaksi SQL (`withTransaction`)**: kunci dan validasi ulang lamaran berstatus `ACCEPTED`, lowongan, izin/scope, serta data organisasi; buat record `employees`, ubah status `applications.stage = 'HIRED'`, buat kontrak pertama (`contracts`), dan buat tugas `checklist_items` kategori `ONBOARDING`. Gunakan `employees.application_id` yang unik sebagai pengaman idempotensi. Jika transaksi gagal, seluruh perubahan database dibatalkan. Pembuatan file/surat eksternal tidak dilakukan di dalam transaksi SQL; jalankan sesudah commit melalui proses yang dapat dicoba ulang dan diaudit.
   * Validasi bahwa perusahaan, jabatan, dan lokasi pilihan memang sesuai dengan lowongan dan brand yang diizinkan. Normalisasi email dan nomor telepon sebelum disimpan/dicocokkan; bila pencocokan menemukan beberapa riwayat karyawan, tampilkan semua kecocokan yang relevan untuk ditinjau HR, jangan memilih satu secara diam-diam.

### 4.3 Kontrak Kerja & Pengingat Otomatis

* Jenis kontrak (`PKWT 2 Bulan`, `PKWT 3 Bulan`, `PKWT 6 Bulan`, `PKWT 1 Tahun`, `Magang`, `PKWTT/Tetap`) berada di modul `contracts`, bukan kolom status di `employees`.
* Kontrak membentuk rantai perpanjangan melalui `previous_contract_id`.
* **Aturan Pengingat (Hanya untuk karyawan `is_active = TRUE` dan kontrak yang masih memerlukan keputusan):**
  * **Pengingat awal** pada `end_date - contract_types.reminder_days`: Badge **Kuning** (*Kontrak akan berakhir*).
  * **H-7**: Badge **Oranye** (*Prioritas tinggi*), hanya bila tanggal pengingat awal lebih dari 7 hari sebelum akhir kontrak; setiap tahap hanya dikirim sekali per kontrak.
  * **Lewat Tanggal (`end_date < CURDATE()`):** Badge **Merah** (*Kontrak berakhir, belum ada keputusan*). **Sistem dilarang menonaktifkan karyawan secara otomatis** sampai HRD mengambil keputusan:
    1. *Perpanjang:* Membuat kontrak baru (`start_date` = sehari setelah kontrak lama), menutup kontrak lama menjadi `EXTENDED`, dan men-generate surat kontrak baru.
    2. *Jadikan Tetap:* Membuat kontrak `PKWTT` (`end_date = NULL`), menutup kontrak lama menjadi `MADE_PERMANENT`.
    3. *Tidak Diperpanjang:* Mengisi `exit_date` & `exit_reason_id` karyawan, menonaktifkan karyawan, menutup kontrak menjadi `NOT_EXTENDED`, dan membuat `checklist_items` kategori `OFFBOARDING`.
* **Cron Endpoint:** `GET /api/cron/contract-reminder` dengan validasi header `Authorization: Bearer <CRON_SECRET>` menggunakan perbandingan waktu-konstan. Batasi akses endpoint, jangan mencatat secret, dan catat status pengiriman di `notification_logs` dengan klaim atomik dan kunci unik `(contract_id, stage, channel)`. Gunakan provider email dengan idempotency key bila tersedia; tangani retry dan kegagalan secara eksplisit. Pengiriman email dan commit database tidak dapat dijamin sebagai satu operasi atomik, jadi jangan menyatakan jaminan *exactly-once* tanpa dukungan provider.

### 4.4 Generator Surat (`letters`)

* Mendukung 5 jenis dokumen: **SP** (`SP`), **Surat Keterangan Kerja** (`SKK`), **Kontrak Kerja** (`CONTRACT`), **NDA** (`NDA`), dan **Surat Masih Bekerja** (`STILL_WORKING`).
* Menggunakan template `.docx` per CV (`docxtemplater` + `pizzip`) sehingga kop surat otomatis mengikuti `company_id` tempat karyawan terdaftar. Nomor surat per CV/tahun dialokasikan secara atomik menggunakan sequence yang dikunci dalam transaksi dan dilindungi constraint unik; nomor yang sudah dialokasikan tidak digunakan ulang, sehingga kegagalan generate dapat menyisakan nomor yang lompat.

### 4.5 RBAC 3 Lapis (Wajib Ditegakkan di Server)

1. **Lapis 1 (Permission):** Izin dicek langsung dari database pada setiap request/Server Action melalui `requirePermission(user, 'kode.izin')`. Role bawaan sistem (`is_system = TRUE`): `Super Admin`, `Head HRD`, `Admin HRD`, `Admin Brand`, `Viewer`, `Recruiter`.
2. **Lapis 2 (Data Scope):**
   * Jika `users.scope_all = TRUE`, user dapat melihat semua brand.
   * Jika `users.scope_all = FALSE`, helper `applyBrandScope(user)` wajib menyisipkan filter berdasarkan tabel `user_brand_access` pada setiap query karyawan, kontrak, surat, laporan, ekspor, pencarian, serta operasi tulis. Untuk data berelasi, scope diturunkan melalui relasi yang benar ke `companies.brand_id`. Akses tanpa brand yang diizinkan harus *deny by default*; jangan menghilangkan filter saat daftar akses kosong.
   * Lowongan, lokasi, file, dan data recruitment juga harus memiliki aturan scope yang eksplisit. Endpoint file wajib memeriksa izin dan scope terhadap record pemilik file sebelum membaca path di disk.
3. **Lapis 3 (Field Masking):**
   * Tanpa izin `employee.view_sensitive`, fungsi `maskSensitiveFields(user, employee)` wajib menyamarkan NIK/NPWP/No. Rekening menjadi format `6171••••••••1234` dan memblokir akses unduh foto KTP.
   * Buat izin terpisah untuk membaca data pribadi lain (misalnya alamat, tanggal lahir, email, dan telepon); jangan menganggap izin membuka NIK otomatis memberi akses ke semua data pribadi. Terapkan masking pada tampilan, API, log, ekspor, dan semua jalur baca; jangan pernah mencatat nilai sensitif mentah. Setiap aksi baca data sensitif, ekspor, unduh file, dan perubahan data penting wajib dicatat ke `audit_logs`.
   * Middleware hanya untuk pemeriksaan awal/navigasi. Setiap Server Action, Route Handler, dan query yang mengakses data tetap wajib mengautentikasi sesi dan menegakkan permission serta scope di server.

## 5. SKEMA DATABASE MYSQL (`database/schema.sql`)

```sql
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. STRUKTUR ORGANISASI & MASTER DATA
CREATE TABLE IF NOT EXISTS brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  name VARCHAR(150) NOT NULL UNIQUE,
  address TEXT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(100) NULL,
  npwp VARCHAR(50) NULL,
  nib VARCHAR(50) NULL,
  letterhead_logo_path VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_companies_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS divisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  division_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_division_position (division_id, name),
  CONSTRAINT fk_positions_division FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NULL,
  name VARCHAR(150) NOT NULL UNIQUE,
  city VARCHAR(100) NULL,
  address TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_locations_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exit_reasons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  severity ENUM('GREEN', 'YELLOW', 'RED') NOT NULL DEFAULT 'GREEN',
  rehirable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. AUTH INTERNAL, RBAC 3 LAPIS, & AUDIT
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  module VARCHAR(50) NOT NULL,
  description VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  session_version INT UNSIGNED NOT NULL DEFAULT 0,
  scope_all BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_brand_access (
  user_id INT NOT NULL,
  brand_id INT NOT NULL,
  PRIMARY KEY (user_id, brand_id),
  CONSTRAINT fk_uba_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uba_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS feature_flags (
  feature_key VARCHAR(60) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id VARCHAR(60) NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. RECRUITMENT (AKUN KANDIDAT + LAMARAN)
CREATE TABLE IF NOT EXISTS candidate_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  session_version INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  nik_encrypted TEXT NULL,
  nik_hash VARCHAR(64) NULL,
  birth_place VARCHAR(100) NULL,
  birth_date DATE NULL,
  address_current TEXT NULL,
  last_education VARCHAR(100) NULL,
  cv_file_path VARCHAR(255) NULL,
  portfolio_url VARCHAR(255) NULL,
  is_talent_pool BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_candidate_nik_hash (nik_hash),
  CONSTRAINT fk_candidates_account FOREIGN KEY (account_id) REFERENCES candidate_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vacancies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  position_id INT NOT NULL,
  location_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL,
  quota INT NOT NULL DEFAULT 1,
  status ENUM('DRAFT', 'OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  published_at DATETIME NULL,
  closed_at DATE NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vacancies_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_vacancies_position FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_vacancies_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_vacancies_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vacancy_id INT NOT NULL,
  candidate_id INT NOT NULL,
  cv_snapshot_path VARCHAR(255) NULL,
  expected_salary DECIMAL(15, 2) NULL,
  offered_salary DECIMAL(15, 2) NULL,
  agreed_join_date DATE NULL,
  stage ENUM(
    'APPLIED',
    'SCREENING',
    'INTERVIEW_HR',
    'INTERVIEW_USER',
    'TEST',
    'OFFERING',
    'ACCEPTED',
    'REJECTED',
    'HIRED'
  ) NOT NULL DEFAULT 'APPLIED',
  rejection_reason VARCHAR(255) NULL,
  consent_given BOOLEAN NOT NULL,
  consent_at DATETIME NULL,
  consent_policy_version VARCHAR(40) NULL,
  consent_withdrawn_at DATETIME NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vacancy_candidate (vacancy_id, candidate_id),
  INDEX idx_app_stage (stage),
  CONSTRAINT chk_application_consent CHECK (
    consent_given = TRUE AND consent_at IS NOT NULL AND consent_policy_version IS NOT NULL
  ),
  CONSTRAINT fk_app_vacancy FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_app_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 4. KARYAWAN (PUSAT DATA HR INTERNAL)
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  nik_encrypted TEXT NOT NULL,
  nik_hash VARCHAR(64) NOT NULL UNIQUE,
  birth_place VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  blood_type VARCHAR(5) NULL,
  mother_name VARCHAR(150) NULL,
  religion VARCHAR(30) NULL,
  marital_status ENUM('SINGLE', 'MARRIED', 'DIVORCED') NOT NULL DEFAULT 'SINGLE',
  children_count INT NOT NULL DEFAULT 0,
  address_current TEXT NOT NULL,
  address_ktp TEXT NOT NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(30) NOT NULL,
  npwp_encrypted TEXT NULL,
  bank_name VARCHAR(60) NULL,
  bank_account_encrypted TEXT NULL,
  ktp_photo_path VARCHAR(255) NULL,
  cv_file_path VARCHAR(255) NULL,

  company_id INT NOT NULL,
  position_id INT NOT NULL,
  location_id INT NOT NULL,

  join_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  exit_date DATE NULL,
  exit_reason_id INT NULL,

  application_id INT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_emp_company_active (company_id, is_active),
  INDEX idx_emp_position (position_id),
  INDEX idx_emp_location (location_id),
  INDEX idx_emp_email (email),
  INDEX idx_emp_phone (phone),
  CONSTRAINT fk_emp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_emp_position FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_emp_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_emp_exit_reason FOREIGN KEY (exit_reason_id) REFERENCES exit_reasons(id) ON DELETE RESTRICT,
  CONSTRAINT fk_emp_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT,
  CONSTRAINT chk_employee_children CHECK (children_count >= 0),
  CONSTRAINT chk_employee_exit_state CHECK (
    (is_active = TRUE AND exit_date IS NULL AND exit_reason_id IS NULL) OR
    (is_active = FALSE AND exit_date IS NOT NULL AND exit_reason_id IS NOT NULL)
  )
) ENGINE=InnoDB;

-- 5. KONTRAK KERJA, SURAT, & PENGINGAT
CREATE TABLE IF NOT EXISTS contract_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  default_months INT NULL,
  reminder_days INT NOT NULL DEFAULT 14,
  is_permanent BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS letter_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('SP', 'SKK', 'CONTRACT', 'NDA', 'STILL_WORKING') NOT NULL,
  name VARCHAR(120) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  contract_type_id INT NOT NULL,
  contract_number VARCHAR(80) NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  base_salary DECIMAL(15, 2) NULL,
  status ENUM('RUNNING', 'EXTENDED', 'MADE_PERMANENT', 'NOT_EXTENDED', 'ENDED') NOT NULL DEFAULT 'RUNNING',
  previous_contract_id INT NULL UNIQUE,
  letter_id INT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_contract_end_status (end_date, status),
  CONSTRAINT chk_contract_date_range CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT fk_contract_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contract_type FOREIGN KEY (contract_type_id) REFERENCES contract_types(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contract_prev FOREIGN KEY (previous_contract_id) REFERENCES contracts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS letters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  letter_number VARCHAR(100) NOT NULL UNIQUE,
  type ENUM('SP', 'SKK', 'CONTRACT', 'NDA', 'STILL_WORKING') NOT NULL,
  employee_id INT NOT NULL,
  company_id INT NOT NULL,
  template_id INT NULL,
  file_path VARCHAR(255) NOT NULL,
  status ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED') NOT NULL DEFAULT 'ISSUED',
  issued_date DATE NOT NULL,
  metadata JSON NULL,
  created_by INT NULL,
  approved_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_letters_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_letters_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_letters_template FOREIGN KEY (template_id) REFERENCES letter_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_letters_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_letters_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS letter_sequences (
  company_id INT NOT NULL,
  letter_year SMALLINT UNSIGNED NOT NULL,
  next_number INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (company_id, letter_year),
  CONSTRAINT fk_letter_sequence_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

ALTER TABLE contracts
  ADD CONSTRAINT fk_contract_letter FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS notification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contract_id INT NOT NULL,
  stage ENUM('INITIAL', 'H7', 'OVERDUE') NOT NULL,
  channel ENUM('EMAIL', 'IN_APP') NOT NULL DEFAULT 'EMAIL',
  status ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contract_stage_channel (contract_id, stage, channel),
  CONSTRAINT fk_notif_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS checklist_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  category ENUM('ONBOARDING', 'OFFBOARDING') NOT NULL,
  title VARCHAR(180) NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by INT NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_checklist_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_checklist_user FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
```

**Aturan integritas dan migrasi database:**
* Terapkan perubahan skema sebagai migrasi bernomor dan diuji pada versi MySQL/MariaDB minimum di atas. `CREATE TABLE IF NOT EXISTS` tidak mengubah tabel yang sudah ada; jangan menganggap menjalankan ulang file skema akan memperbarui database. Perubahan constraint seperti `fk_contract_letter` harus dikelola sebagai migrasi.
* Constraint `CHECK` menegakkan aturan lokal pada satu record. Aturan lintas tabel—misalnya `previous_contract_id` harus menunjuk kontrak karyawan yang sama, rantai kontrak tidak boleh membentuk siklus, kontrak karyawan tidak boleh tumpang tindih, dan company/position/location lowongan harus konsisten—wajib divalidasi di server dalam transaksi dengan penguncian record yang relevan.
* Semua perubahan status karyawan/kontrak dan lamaran harus memakai transaksi. Jangan hard-delete karyawan, lamaran yang sudah bersejarah, kontrak, surat, atau log; gunakan status, arsip, atau anonimisasi sesuai kebijakan retensi.
* Normalisasi email (trim dan lowercase) serta nomor telepon ke format konsisten sebelum menyimpan dan membandingkan. Email/telepon karyawan tidak unik karena satu orang dapat memiliki beberapa riwayat; gunakan indeks pencarian dan tangani hasil duplikat/ambigu secara eksplisit.
* `notification_logs` berfungsi sebagai outbox/rekam percobaan: buat klaim unik secara atomik sebelum pengiriman, update status dan percobaan, dan proses ulang kegagalan dengan idempotency key provider bila didukung. Jangan simpan secret, token, atau data pribadi di `last_error`; sanitasi dan batasi pesan error. Jangan menghapus riwayat pengiriman saat kontrak berubah status.
* Alokasikan nomor surat melalui `letter_sequences` dalam transaksi: buat baris bila belum ada, kunci dengan `SELECT ... FOR UPDATE`, ambil nomor berikutnya dan naikkan counter. Nomor yang telah dialokasikan tidak boleh dipakai kembali.

## 6. ROADMAP PENGERJAAN BERTAHAP (FASE 0 – FASE 8)

AI Code Assistant wajib mengerjakan dan memverifikasi satu fase penuh sebelum berpindah ke fase berikutnya:

* **FASE 0 (Fondasi & Database):** Setup proyek Next.js (TypeScript) dengan pemeriksaan tipe aktif, `src/types/database.ts`, `src/core/db.ts` (`mysql2/promise` pool limit 10), skema dan migrasi bernomor yang diuji pada versi database target, serta `database/seed.ts` (5 Brand, 6 CV, 5 Divisi, semua Jabatan, Exit Reasons, Contract Types, Permissions, Roles, dan akun Super Admin awal).
* **FASE 1 (Core Security, Auth & Master Data):**
  * Enkripsi AES-256-GCM + blind index, pengelolaan kunci/rotasi, dan validasi sesi berversi (`src/core/crypto/field-encrypt.ts`).
  * Sistem Login & Session Internal (`(auth)/login`), invalidasi sesi, rate limit lintas instance, serta Middleware (`src/middleware.ts`).
  * RBAC 3 Lapis (`requirePermission`, `applyBrandScope`, `maskSensitiveFields`), Manajemen User, Matriks Role dinamis, Saklar Fitur (`feature_flags`), Audit Log, & CRUD Master Data (proteksi item terpakai agar tidak bisa dihapus).
* **FASE 2 (Modul Karyawan):**
  * Form tambah/edit karyawan dengan *cascading dropdown* (Brand $\rightarrow$ CV, Divisi $\rightarrow$ Jabatan), upload foto KTP ke storage privat, enkripsi NIK/NPWP/Rekening, hitung masa kerja otomatis, filter, pencarian, dan alur nonaktifkan karyawan (`deactivateEmployee`).
* **FASE 3 (Dashboard & Laporan):**
  * Widget ringkasan total karyawan aktif/nonaktif per Brand, CV, Divisi, dan Lokasi; rekap turnover; serta ekspor laporan ke CSV/Excel.
* **FASE 4 (Kontrak Kerja & Pengingat Otomatis):**
  * CRUD kontrak, rantai perpanjangan (`previous_contract_id`), transaksi keputusan dengan validasi overlap, keputusan pengingat (*Perpanjang / Jadikan Tetap / Tidak Diperpanjang*), widget kontrak akan habis, dan API `/api/cron/contract-reminder` dengan outbox/retry.
* **FASE 5 (Generator Surat):**
  * Manajemen template DOCX per CV, sequence penomoran atomik per CV/tahun, alur persetujuan (Draft $\rightarrow$ Legal/Head HRD $\rightarrow$ Issued), dan generate 5 jenis surat (SP, SKK, Kontrak, NDA, Surat Masih Bekerja).
* **FASE 6 (Website Profil, Portal Kandidat & Recruitment):**
  * Halaman publik profil 5 brand & daftar lowongan (`(public)`).
  * Registrasi & Login Kandidat (`(public)/kandidat`), pengisian profil & upload CV privat, pencatatan persetujuan privasi, serta pengajuan lamaran.
  * Dashboard HR Recruitment (`(recruitment)`): Kanban tahap seleksi, deteksi mantan karyawan (`GREEN`/`YELLOW`/`RED`), scope/field masking, dan transaksi `hireCandidate` yang aman terhadap pengulangan (Pelamar $\rightarrow$ Karyawan).
* **FASE 7 (Checklist & Operasional Head Office):**
  * Checklist Onboarding & Offboarding otomatis saat karyawan masuk/keluar, pelacakan masa berlaku SP1/SP2/SP3, serta import Excel karyawan massal dengan pratinjau validasi.
* **FASE 8 (Pengembangan Lanjutan Sesuai Prioritas):**
  * Manajemen cuti & izin, rekap payroll & BPJS per CV, inventaris seragam/aset, serta portal *self-service* karyawan.