# Fondasi HR dan keuangan

## Modul yang tersedia

- `/finance`: periode bulanan, filter organisasi dan pencarian, daftar 25 baris, kelengkapan, verifikasi, jenis hubungan kerja dari kontrak yang berlaku, gaji disetujui pada akhir periode, perubahan terjadwal dan pengajuan pending.
- Kartu tindakan dashboard menuju daftar yang perlu dilengkapi, diverifikasi, atau diputuskan.
- Profil keuangan: pencatatan awal/perubahan gaji, keputusan pengguna lain, pembatalan oleh pengaju, riwayat dan penanda berlaku surut. Nilai gaji adalah desimal, bukan floating point pada penyimpanan.
- Detail karyawan: riwayat penempatan dan mutasi berlaku hari ini. Pengubahan CV/jabatan/outlet melalui edit profil biasa ditolak untuk menjaga riwayat.
- Verifikasi kelengkapan CV/tanggal masuk/NIK/bank/rekening oleh petugas berizin. Perubahan profil atau mutasi membatalkan verifikasi sehingga harus diperiksa kembali.
- Gaji tidak disalin dari kontrak lama secara otomatis. Pencatatan awal harus dikonfirmasi petugas, menyebut tanggal berlaku dan disetujui pengguna lain.

## Hak akses

`finance.view` membuka data gaji; `finance.manage` mengajukan dan membatalkan pengajuan sendiri; `finance.approve` memutuskan pengajuan pengguna lain; `employee.verify` memverifikasi kelengkapan. Mutasi memakai `employee.update` dan `employee.view_private_fields`. Semua pemeriksaan diulang di server dan tetap mengikuti cakupan brand saat ini.

Migrasi memberikan izin baru ke Super Admin dan menyediakan dua peran baru: Keuangan (lihat/ajukan) dan Pemeriksa Keuangan (lihat/putuskan). Pengguna yang sudah ada tidak otomatis ditugaskan ke peran baru. Admin dapat memberikan izin ke peran HR/keuangan/pemeriksa yang tepat melalui Peran & izin. Tidak ada pengguna yang otomatis dipindah perannya atau mendapat hak baru.

Kontrak bergaji pada riwayat/PDF/preview surat hanya tersedia untuk `letter.view` plus `employee.view_sensitive` atau `finance.view`. Pencarian umum tidak mencocokkan nomor telepon tersembunyi.

## Batas makna tampilan

Ini persiapan data keuangan, bukan mesin payroll. Tidak ada status dibayar, total THP, perhitungan pajak/BPJS, prorata, rapel otomatis, atau export payroll yang belum dihitung. Data identitas dan organisasi/filter mengikuti profil saat ini, sedangkan nominal gaji dan jenis hubungan kerja mengikuti tanggal periode. Riwayat penempatan ditampilkan terpisah; snapshot baseline bukan bukti penempatan pada masa lalu. Gaji di akhir bulan tidak menggantikan perhitungan prorata bila berubah di tengah bulan.

Persetujuan surat dan seluruh siklus payroll belum ditambahkan dalam paket ini. Status surat lama tetap mengikuti implementasi yang sudah berjalan; jangan menyebutnya sebagai alur persetujuan.

## Peluncuran database

Migrasi `0018_finance_foundation.sql` bersifat menambah: tabel penempatan, pengajuan gaji, verifikasi dan izin. Tidak menghapus tabel/karyawan/arsip dan tidak mengubah nominal kontrak lama. Baseline penempatan diberi tanggal Jakarta saat migrasi, bukan tanggal masuk yang belum terbukti.

Build Vercel production untuk branch `main` menjalankan migrasi ini setelah `next build` berhasil. Preview/local/CI build tidak menulis ke database. Skrip menggunakan named lock, checksum dan `schema_migrations`, serta tidak menjalankan migrasi lama yang belum diterapkan. Kegagalan migrasi menggagalkan deployment. CI menguji migrasi penuh pada MySQL sementara.

Jika rollback kode diperlukan, pertahankan tabel baru. Jangan menghapus riwayat yang sudah dipakai. Periksa log `[finance-schema]` untuk memastikan migrasi berhasil sebelum menggunakan menu.
