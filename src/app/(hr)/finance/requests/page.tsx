import Link from "next/link";
import {requirePermission,requireFeatureEnabled} from "@/core/rbac/guard";
import {PERMISSIONS} from "@/core/rbac/permissions";
import {listSalaryChanges} from "@/modules/finance/queries";
import {parsePage} from "@/components/shared/pagination";
import {PageHeader,buttonSecondary} from "@/components/ui/primitives";
import SalaryList from "../salary-list";
export const instant=false;
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const actor=await requirePermission(PERMISSIONS.financeView);await requireFeatureEnabled("employees");
 const params=await searchParams;const data=await listSalaryChanges(actor,"requests",parsePage(params.page));
 return <div className="space-y-5"><PageHeader title="Pengajuan Gaji" description="Periksa pengajuan yang menunggu keputusan. Buka nama karyawan untuk melihat rincian dan tindakan sesuai izin Anda." action={<Link href="/finance" className={buttonSecondary}>Data Keuangan</Link>}/><SalaryList data={data} mode="requests"/></div>;
}
