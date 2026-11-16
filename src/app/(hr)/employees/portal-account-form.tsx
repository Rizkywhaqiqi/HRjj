import { createEmployeePortalAccountAction } from "@/modules/employees";
import { Card, CardBody, inputClass, buttonPrimary } from "@/components/ui/primitives";

export default function PortalAccountForm({ employeeId, email }: { employeeId: number; email: string | null }) {
  return <Card className="mt-5"><CardBody><h2 className="text-lg font-semibold">Akun portal karyawan</h2><p className="mt-1 text-sm text-slate-500">Buat atau reset akses self-service. Password sementara minimal 12 karakter.</p><form action={createEmployeePortalAccountAction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="employeeId" value={employeeId} /><input name="email" type="email" required defaultValue={email ?? ""} placeholder="Email portal" className={inputClass} /><input name="temporaryPassword" type="password" required minLength={12} placeholder="Password sementara" className={inputClass} /><button className={`${buttonPrimary} sm:col-span-2`}>Simpan akses portal</button></form></CardBody></Card>;
}
