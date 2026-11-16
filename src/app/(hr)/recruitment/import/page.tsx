import Link from "next/link";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listInternalVacancies } from "@/modules/recruitment";
import {
  buttonSecondary,
  Card,
  CardBody,
  PageHeader,
} from "@/components/ui/primitives";
import CandidateImportForm from "./candidate-import-form";

export const instant = false;

export default async function CandidateImportPage() {
  const actor = await requirePermission(PERMISSIONS.recruitmentManage);
  await requireFeatureEnabled("recruitment");
  const vacancies = (await listInternalVacancies(actor)).filter(
    (vacancy) => vacancy.status === "OPEN",
  );

  return (
    <div>
      <PageHeader
        title="Import kandidat"
        description="Unggah XLSX untuk membuat lamaran berstatus menunggu keputusan pada lowongan yang dipilih."
        action={
          <Link href="/recruitment" className={buttonSecondary}>
            Kembali ke kandidat
          </Link>
        }
      />
      <Card>
        <CardBody>
          <div className="mb-5 space-y-2 text-sm leading-6 text-slate-600">
            <p>
              Unduh template, isi satu kandidat per baris, lalu lakukan preview
              sebelum menyimpan. Wajib isi nama, email, nomor telepon, dan
              <code className="mx-1 rounded bg-slate-100 px-1">consent</code>
              dengan nilai <strong>YA</strong> untuk setiap kandidat yang sudah
              menyetujui datanya digunakan.
            </p>
            <p>
              Kandidat yang diimpor muncul sebagai lamaran baru dan belum
              diterima. Setelah diterima, buat data karyawan dari halaman
              kandidat; data tersebut masuk staging untuk dilengkapi.
            </p>
            <p>
              Impor tidak mengirim undangan atau password portal kepada kandidat.
            </p>
          </div>
          {vacancies.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              Belum ada lowongan terbuka dalam scope Anda. Buka lowongan terlebih
              dahulu sebelum mengimpor kandidat.
            </p>
          ) : (
            <CandidateImportForm vacancies={vacancies.map(({ id, title, company_name }) => ({
              id,
              title,
              companyName: company_name,
            }))} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
