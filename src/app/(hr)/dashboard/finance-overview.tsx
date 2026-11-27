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
  return (
    <Card>
      <CardHeader
        title="Pekerjaan keuangan"
        description={`Periode ${data.period.month} · mengikuti cakupan brand akun`}
        action={
          <Link href="/finance" className={buttonPrimary}>
            Buka keuangan karyawan
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
              className="rounded-xl bg-slate-50 p-4 hover:bg-brand-50"
            >
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{Number(count)}</p>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {Number(data.summary.changed)} karyawan memiliki perubahan gaji
          disetujui yang berlaku periode ini. Angka ini bukan jumlah pembayaran
          atau hasil payroll final.
        </p>
      </CardBody>
    </Card>
  );
}
