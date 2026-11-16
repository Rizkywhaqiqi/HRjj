import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaffSession } from "@/core/auth/session";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { ChangePasswordForm } from "./change-password-form";

export const instant = false;

export default async function ChangePasswordPage() {
  const user = await requireStaffSession();

  return (
    <div className="mx-auto w-full max-w-xl">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-brand-700"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Kembali ke dashboard
      </Link>

      <Card>
        <CardHeader
          title="Ganti password"
          description={`${user.name} · ${user.roleName}`}
        />
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Mengganti password akan menaikkan versi sesi dan mencabut seluruh sesi
        lain di perangkat lain. Minimal 12 karakter.
      </p>
    </div>
  );
}
