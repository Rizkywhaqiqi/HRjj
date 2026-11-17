import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JOJO HR Space | Dokumentasi karyawan",
  description:
    "Aplikasi internal untuk data karyawan, kontrak, surat, dan laporan HR.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
