import Link from "next/link";
import { hasPermission, requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { createEmployeeAction } from "@/modules/employees";
import {
  listBrandOptions,
  listCompanyOptions,
  listDivisionOptions,
  listLocations,
  listPositionOptions,
} from "@/modules/master-data";
import { Card, CardBody, CardHeader, PageHeader, buttonSecondary } from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import EmployeeForm from "../employee-form";

export const instant = false;

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.employeeCreate);
  await requireFeatureEnabled("employees");
  const [brands, companies, divisions, positions, locations, params] = await Promise.all([
    listBrandOptions(actor),
    listCompanyOptions(actor),
    listDivisionOptions(),
    listPositionOptions(),
    listLocations(actor),
    searchParams,
  ]);

  return (
    <div>
      <PageHeader
        title="Tambah karyawan"
        description="Nama dan penempatan kerja wajib diisi. Data lainnya dapat dilengkapi setelah karyawan aktif."
        action={
          <Link href="/employees" className={buttonSecondary}>
            Kembali ke daftar
          </Link>
        }
      />
      <FlashAlerts {...readFlash(params)} />
      <Card>
        <CardHeader
          title="Form karyawan baru"
          description="Isi data yang tersedia sekarang; profil dapat dilengkapi kapan saja dari halaman karyawan."
        />
        <CardBody>
          <EmployeeForm
            action={createEmployeeAction}
            brands={brands}
            companies={companies}
            divisions={divisions}
            positions={positions}
            locations={locations}
            canViewSensitive={hasPermission(actor, PERMISSIONS.employeeViewSensitive)}
          />
        </CardBody>
      </Card>
    </div>
  );
}
