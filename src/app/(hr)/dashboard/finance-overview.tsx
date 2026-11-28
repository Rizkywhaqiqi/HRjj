import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { SessionUser } from "@/types/database";
import { financeDirectory } from "@/modules/finance/queries";
import { jakartaToday } from "@/modules/finance/policy";
import {
  Card,
  CardBody,
  CardHeader,
  buttonPrimary,
} from "@/components/ui/primitives";
export default async function FinanceOverview({
  actor,
}: {
  actor: SessionUser;
}) {
  const data = await financeDirectory(
    actor,
    { month: jakartaToday().slice(0, 7) },
    1,
  );
  const periodLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${data.period.start}T00:00:00Z`));
  return (
    <Card>
      <CardHeader
        title="Ringkasan keuangan"
        description={`${periodLabel} · karyawan aktif dalam akses Anda`}
        action={
          <Link href="/finance" className={buttonPrimary}>
            Lihat data gaji <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Data belum lengkap", data.summary.incomplete, "incomplete"],
            ["Belum diverifikasi", data.summary.unverified, "unverified"],
            ["Menunggu keputusan gaji", data.summary.pending, "pending"],
          ].map(([label, count, task]) => (
            <Link
              href={`/finance?task=${task}`}
              key={String(label)}
              className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-brand-300 hover:bg-brand-50/30 focus-visible:outline-2 focus-visible:outline-brand-600 sm:block sm:p-4"
            >
              <p className="text-sm text-slate-500">{label}</p>
              <div className="flex items-center gap-3 sm:mt-3 sm:justify-between">
                <p className="text-2xl font-semibold tabular-nums text-slate-950">
                  {Number(count)}
                </p>
                <ArrowUpRight
                  size={15}
                  aria-hidden="true"
                  className="text-slate-400 group-hover:text-brand-700"
                />
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
          {Number(data.summary.changed)} karyawan memiliki perubahan gaji
          disetujui yang berlaku periode ini. Angka ini bukan jumlah pembayaran
          atau hasil payroll final.
        </p>
      </CardBody>
    </Card>
  );
}
