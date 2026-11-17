import Link from "next/link";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  buttonSecondary,
} from "@/components/ui/primitives";
import ImportForm from "./import-form";
export const instant = false;
export default async function ImportPage() {
  await requirePermission(PERMISSIONS.employeeCreate);
  await requireFeatureEnabled("employees");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Import karyawan"
        description="Masukkan banyak karyawan dari Excel atau ekspor aplikasi recruitment terpisah."
        action={
          <Link href="/employees" className={buttonSecondary}>
            Kembali ke karyawan
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [
            "1. Siapkan file",
            "Unduh format Excel. Isi data atau gunakan ekspor recruitment dengan header yang sama.",
          ],
          [
            "2. Periksa data",
            "Nama organisasi dicocokkan dengan master data. Kesalahan ditampilkan per baris.",
          ],
          [
            "3. Simpan karyawan",
            "Data valid menjadi karyawan aktif. Data lama tidak ditimpa.",
          ],
        ].map(([title, text]) => (
          <Card key={title}>
            <CardHeader title={title} />
            <CardBody>
              <p className="text-sm text-slate-600">{text}</p>
            </CardBody>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader
          title="Unggah file Excel"
          description="Maksimal 500 baris dan 1,5 MB. KTP diunggah terpisah dari profil karyawan."
          action={
            <a
              href="/api/employees/import/template"
              className={buttonSecondary}
            >
              Unduh format & referensi
            </a>
          }
        />
        <CardBody>
          <ImportForm />
        </CardBody>
      </Card>
      <p className="text-sm text-slate-500">
        Untuk integrasi recruitment berikutnya, gunakan format hrjj-employees-v1
        dan employeeCode yang stabil. Tidak perlu menghubungkan database kedua
        aplikasi.
      </p>
    </div>
  );
}
