# JOJO HR Space

Aplikasi internal untuk dokumentasi karyawan JOJO GROUP. Stack: Next.js App Router, TypeScript, Tailwind, MySQL (Aiven), Vercel, dan Cloudflare R2 privat.

## Modul

- Dashboard: jumlah karyawan aktif/nonaktif, rekap brand, divisi, lokasi, dan pengingat kontrak.
- Karyawan: tambah, cari, filter, detail, edit, nonaktifkan, dan unggah/lihat KTP (maksimal 1,5 MiB).
- Kontrak: catat masa kontrak, perpanjangan, keputusan, serta pengingat H-30/H-7/lewat masa di dashboard.
- Surat & riwayat: SP, surat keterangan kerja, kontrak kerja, NDA, surat masih bekerja. Template bawaan; tidak ada unggah template.
- Laporan: rekap dan ekspor CSV/Excel/PDF sesuai izin.
- Master data dan pengaturan: organisasi, jenis kontrak, pengguna, peran, serta audit aktivitas.

Recruitment, portal kandidat/karyawan, payroll, cuti, inventaris, dan checklist tidak tersedia dalam aplikasi ini. Kode halaman, endpoint, dan action modul tersebut dihapus. Tabel lama tetap dipertahankan sebagai data historis agar rollout tidak menghapus data operasional atau merusak relasi database.

## Menjalankan

1. Gunakan Node.js 24 dan MySQL 8.4 (minimal 8.0.16).
2. `npm ci`.
3. Untuk lokal, `npm run env:init`, lalu sesuaikan koneksi DB. Untuk produksi, isi environment dari secret manager; jangan membuat atau mengganti kunci enkripsi data yang sudah ada.
4. Untuk **database baru saja**, jalankan `npm run db:migrate` lalu `npm run db:seed`.
5. `npm run dev`. Beranda membuka dashboard atau login HR.

Akun pertama berasal dari `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`. Jangan memakai data pribadi asli untuk demo tes.

## Cara kerja surat

HR memilih karyawan, jenis surat, tanggal, penandatangan, serta isian khusus. Tombol Periksa menampilkan ringkasan sebelum penyimpanan. Setelah disimpan, preview dan unduh PDF tersedia dari riwayat.

- `letters.metadata` berisi snapshot identitas, perusahaan, jabatan, isi paragraf, dan versi template.
- `letters.file_path` untuk surat baru berisi penanda `snapshot:v1:...`, bukan path file.
- Nomor dialokasikan secara atomik per perusahaan/tahun, memuat ID perusahaan agar tidak bentrok antar-CV dalam satu brand.
- PDF dirender dalam memori dan dikirim dengan cache privat/no-store. Tidak ditulis ke filesystem atau R2.
- Unduh ulang memakai snapshot dan renderer v1 yang sama, bukan data profil terbaru. Versi berikutnya harus ditambahkan sebagai renderer baru; jangan mengganti renderer historis.
- Tidak ada approval bertingkat. Izin `letter.create` mengizinkan pencatatan surat; `letter.view` mengizinkan pembacaan/unduh dalam scope brand.
- Surat lama tetap dapat diunduh sebagai DOCX jika file aslinya tersedia di R2. Riwayat tanpa snapshot tidak boleh ditebak dari profil terbaru.
- PDF yang dibuat belum memiliki tanda tangan basah/digital. Tempat tanda tangan disediakan. Ketentuan kontrak dan NDA diisi dari ketentuan perusahaan yang disepakati.

## Penyimpanan KTP

Vercel memerlukan `FILE_STORAGE=r2`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, dan `R2_SECRET_ACCESS_KEY`. Kedua key hanya berada di server, bukan `NEXT_PUBLIC_*`. Bucket harus privat tanpa akses publik r2.dev/custom domain. Endpoint KTP memeriksa izin data sensitif dan scope brand serta mencatat audit akses.

Mode `FILE_STORAGE=local` hanya untuk development. Arsip lama bisa disalin menggunakan `npm run storage:migrate` (dry-run), kemudian `npm run storage:migrate -- --apply` dari sumber/backup yang masih mempunyai file tersebut. Skrip tidak menghapus sumber atau menimpa objek berbeda.

## Import karyawan / ekspor recruitment terpisah

Gunakan halaman Karyawan → Import karyawan → Unduh format & referensi. Format XLSX **hrjj-employees-v1** memiliki sheet pertama bernama `Karyawan`, berikut header stabil:

`employeeCode, fullName, brandName, companyName, positionName, locationName, joinDate, nik, birthPlace, birthDate, addressCurrent, addressKtp, email, phone, maritalStatus, childrenCount`

- Minimal: `fullName`, `positionName`, `locationName`, serta salah satu `companyName` atau `brandName`.
- Nama harus cocok dengan master. Sheet Referensi berisi ID, nama, dan relasi organisasi sesuai akses HR. Kolom ID lama `brandId`, `companyId`, `positionId`, `locationId` tetap didukung. Jika nama ambigu, gunakan ID master.
- Ekspor aplikasi recruitment berikutnya memakai header ini; isi `employeeCode` yang stabil dan unik agar pengunggahan ulang ditolak sebagai duplikat. Tanpa kode/NIK, baris yang sama tidak dapat dikenali secara pasti sebagai orang yang sama.
- NIK/telepon ditulis sebagai teks. Tanggal menerima YYYY-MM-DD, DD/MM/YYYY, atau tanggal Excel.
- Tidak ada CV/KTP di workbook. Maksimal 500 baris dan 1,5 MiB.
- Periksa file sebelum simpan. Preview memvalidasi bentuk data, relasi organisasi, akses, kode/NIK duplikat. Simpan dilakukan satu transaksi tanpa menimpa data lama.
- File berbeda menghapus hasil preview sebelumnya. Kesalahan harus diperbaiki sebelum tombol simpan aktif.

## Validasi dan deployment

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. CI juga menguji migrasi dan seed pada database sementara. Perubahan penyederhanaan ini tidak membutuhkan migrasi skema atau seed produksi. Jangan jalankan skrip cleanup/drop terhadap database operasional untuk rollout ini.
