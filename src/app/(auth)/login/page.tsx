import { redirect } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { getSessionUser } from "@/core/auth/session";
import { sanitizeNextPath } from "@/core/http/navigation";
import {
  Alert,
  Card,
  CardBody,
} from "@/components/ui/primitives";
import { LoginForm } from "./login-form";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const flashOk = typeof params.ok === "string" ? params.ok : undefined;
  const flashError = typeof params.error === "string" ? params.error : undefined;

  return (
    <Card>
      <CardBody className="space-y-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
            <BriefcaseBusiness aria-hidden="true" size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-brand-700">
              JOJO HR Space
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">
              Masuk ke akun staf internal
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Gunakan email dan password yang diberikan oleh HRD.
            </p>
          </div>
        </div>

        {flashOk ? <Alert tone="success">{flashOk}</Alert> : null}
        {flashError ? <Alert tone="error">{flashError}</Alert> : null}

        <LoginForm nextPath={nextPath} />

        <p className="text-center text-xs leading-5 text-slate-500">
          Akses terbatas untuk staf JOJO GROUP. Setiap aktivitas login dan
          perubahan data tercatat di audit log.
        </p>
      </CardBody>
    </Card>
  );
}
