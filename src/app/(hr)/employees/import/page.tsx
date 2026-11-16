import Link from "next/link";
import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import ImportForm from "./import-form";
export const instant = false;
export default async function EmployeeImportPage() { await requirePermission(PERMISSIONS.employeeCreate); return <div><PageHeader title="Import karyawan" description="Baris valid langsung menjadi karyawan aktif. CV boleh dikosongkan jika brand sudah ditentukan; profil yang belum lengkap dapat diperbarui nanti. XLSX maksimal 500 baris." /><Card><CardBody><p className="mb-4 text-sm text-slate-600">Header wajib: fullName, positionId, locationId, dan salah satu dari brandId atau companyId. companyId boleh kosong; jika diisi, brand mengikuti CV. Kolom pribadi seperti NIK, birthPlace, birthDate, addressCurrent, addressKtp, phone, joinDate, maritalStatus, dan childrenCount boleh kosong. employeeCode opsional; jika kosong, ID dibuat otomatis. Kolom tanggal menerima tanggal Excel, YYYY-MM-DD, atau DD/MM/YYYY. NIK tidak pernah ditampilkan dalam preview. Kandidat yang diterima dilengkapi lewat menu staging kandidat, bukan lewat import karyawan.</p><ImportForm /><Link href="/employees" className="mt-5 inline-flex text-sm font-semibold text-brand-700">← Kembali ke karyawan</Link></CardBody></Card></div>; }
