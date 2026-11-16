import Link from "next/link";
import { hasPermission, requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  createCandidateEmployeeDraftAction,
  decideApplicationAction,
  listApplications,
} from "@/modules/recruitment";
import {
  buttonPrimary,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";

export const instant = false;

function applicationStatus(stage: string): { label: string; tone: "success" | "danger" | "neutral" } {
  if (stage === "ACCEPTED") return { label: "Diterima", tone: "success" };
  if (stage === "REJECTED") return { label: "Ditolak", tone: "danger" };
  if (stage === "HIRED") return { label: "Data karyawan dibuat", tone: "success" };
  return { label: "Menunggu keputusan", tone: "neutral" };
}

export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.recruitmentView);
  await requireFeatureEnabled("recruitment");
  const [applications, params] = await Promise.all([
    listApplications(actor),
    searchParams,
  ]);
  const canDecide = hasPermission(actor, PERMISSIONS.recruitmentManage);
  const canCreateEmployee =
    hasPermission(actor, PERMISSIONS.recruitmentHire) &&
    hasPermission(actor, PERMISSIONS.employeeCreate);
  const canManageVacancies = hasPermission(actor, PERMISSIONS.vacancyManage);

  return (
    <div>
      <PageHeader
        title="Kandidat"
        description="Tinjau lamaran, lalu pilih Terima atau Tolak dan tulis alasannya."
        action={
          canDecide || canManageVacancies ? (
            <div className="flex flex-wrap gap-2">
              {canDecide ? (
                <Link href="/recruitment/import" className={buttonPrimary}>
                  Import kandidat
                </Link>
              ) : null}
              {canManageVacancies ? (
                <Link href="/recruitment/vacancies" className={buttonPrimary}>
                  Kelola lowongan
                </Link>
              ) : null}
            </div>
          ) : null
        }
      />
      <FlashAlerts {...readFlash(params)} />

      {applications.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Belum ada kandidat"
              description="Lamaran yang masuk akan muncul di sini."
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {applications.map((item) => {
            const status = applicationStatus(item.stage);
            const isWaiting = !["ACCEPTED", "REJECTED", "HIRED"].includes(item.stage);

            return (
              <li key={item.id}>
                <Card className="h-full">
                  <CardBody className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-slate-900">
                          {item.candidate_name}
                        </h2>
                        <p className="mt-1 break-all text-sm text-slate-500">
                          {item.candidate_email}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          status.tone === "success"
                            ? "bg-emerald-50 text-emerald-700"
                            : status.tone === "danger"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <dl className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">Lowongan</dt>
                        <dd className="mt-0.5 font-medium text-slate-800">{item.vacancy_title}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Brand / CV</dt>
                        <dd className="mt-0.5 font-medium text-slate-800">
                          {item.brand_name} · {item.company_name}
                        </dd>
                      </div>
                    </dl>

                    {item.rehire_severity ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Riwayat mantan karyawan: {item.rehire_severity}. Tinjau sebelum mengambil keputusan.
                      </p>
                    ) : null}

                    {item.acceptance_reason || item.rejection_reason ? (
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">Alasan keputusan:</span>{" "}
                        {item.acceptance_reason ?? item.rejection_reason}
                      </p>
                    ) : null}

                    {isWaiting && canDecide ? (
                      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        <details className="min-w-40 flex-1">
                          <summary className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white">
                            Terima
                          </summary>
                          <form action={decideApplicationAction} className="mt-2 grid gap-2">
                            <input type="hidden" name="applicationId" value={item.id} />
                            <input type="hidden" name="decision" value="ACCEPTED" />
                            <label className="grid gap-1 text-xs font-medium text-slate-600">
                              Alasan menerima
                              <textarea
                                name="reason"
                                required
                                minLength={3}
                                maxLength={255}
                                rows={2}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            </label>
                            <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                              Simpan keputusan
                            </button>
                          </form>
                        </details>
                        <details className="min-w-40 flex-1">
                          <summary className="cursor-pointer rounded-lg border border-rose-200 px-3 py-2 text-center text-sm font-semibold text-rose-700">
                            Tolak
                          </summary>
                          <form action={decideApplicationAction} className="mt-2 grid gap-2">
                            <input type="hidden" name="applicationId" value={item.id} />
                            <input type="hidden" name="decision" value="REJECTED" />
                            <label className="grid gap-1 text-xs font-medium text-slate-600">
                              Alasan menolak
                              <textarea
                                name="reason"
                                required
                                minLength={3}
                                maxLength={255}
                                rows={2}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            </label>
                            <button className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white">
                              Simpan keputusan
                            </button>
                          </form>
                        </details>
                      </div>
                    ) : null}

                    {item.stage === "ACCEPTED" ? (
                      <div className="border-t border-slate-100 pt-3">
                        {item.employee_id ? (
                          <Link
                            href={`/employees/${item.employee_id}`}
                            className="text-sm font-semibold text-brand-700 hover:underline"
                          >
                            Lihat data karyawan
                          </Link>
                        ) : item.employee_staging_id ? (
                          <Link
                            href={`/employees/staging/${item.employee_staging_id}`}
                            className="text-sm font-semibold text-brand-700 hover:underline"
                          >
                            Lanjutkan lengkapi data karyawan
                          </Link>
                        ) : canCreateEmployee ? (
                          <form action={createCandidateEmployeeDraftAction}>
                            <input type="hidden" name="applicationId" value={item.id} />
                            <button className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white">
                              Buat data karyawan
                            </button>
                          </form>
                        ) : (
                          <p className="text-sm text-slate-500">
                            Kandidat diterima. Pengguna dengan akses karyawan dapat melengkapi datanya.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {item.stage === "HIRED" && item.employee_id ? (
                      <div className="border-t border-slate-100 pt-3">
                        <Link
                          href={`/employees/${item.employee_id}`}
                          className="text-sm font-semibold text-brand-700 hover:underline"
                        >
                          Lihat data karyawan
                        </Link>
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
