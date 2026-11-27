import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, requireFeatureEnabled } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { financeEmployee } from "@/modules/finance/queries";
import { money, jakartaToday } from "@/modules/finance/policy";
import {
  requestSalaryAction,
  decideSalaryAction,
  verifyEmployeeAction,
} from "@/modules/finance/actions";
import { SubmitButton } from "@/components/ui/form";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Badge,
  inputClass,
  buttonSecondary,
} from "@/components/ui/primitives";
export const instant = false;
const labels: Record<string, string> = {
  PENDING: "Menunggu keputusan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};
export default async function FinanceDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.financeView);
  await requireFeatureEnabled("employees");
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const data = await financeEmployee(actor, id);
  if (!data) notFound();
  const { employee: e, changes } = data;
  const today = jakartaToday();
  const { current, future } = data;
  const can = (code: string) => actor.permissions.includes(code);
  return (
    <div className="space-y-5">
      <PageHeader
        title={`Keuangan · ${e.full_name}`}
        description={`${e.employee_code} · ${e.company_name ?? "CV belum ditentukan"} · ${e.brand_name}`}
        action={
          <Link href="/finance" className={buttonSecondary}>
            Kembali ke daftar
          </Link>
        }
      />
      <FlashAlerts {...readFlash(await searchParams)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Gaji berlaku hari ini</p>
            <p className="mt-2 text-xl font-semibold">
              {money(current?.amount)}
            </p>
            <p className="text-xs text-slate-500">
              {current
                ? `Sejak ${current.effective_date}`
                : "Ajukan pencatatan awal; gaji kontrak lama tidak ditebak otomatis."}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Perubahan terjadwal</p>
            <p className="mt-2 text-xl font-semibold">{future.length}</p>
            {future.slice(0, 3).map((s) => (
              <p key={s.id} className="text-sm">
                {s.effective_date}: {money(s.amount)}
              </p>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Kelengkapan administrasi</p>
            <p className="mt-2 font-semibold">
              {!e.ready
                ? "Belum lengkap"
                : e.verified_at
                  ? "Terverifikasi"
                  : "Menunggu pemeriksaan"}
            </p>
            <p className="text-xs text-slate-500">
              {e.verified_by
                ? `Diperiksa ${e.verified_by}`
                : "CV, tanggal masuk, NIK, bank, dan rekening harus terisi."}
            </p>
            {can(PERMISSIONS.employeeView) && (
              <Link
                href={`/employees/${id}`}
                className="mt-2 inline-block text-sm underline"
              >
                Buka profil karyawan
              </Link>
            )}
          </CardBody>
        </Card>
      </div>
      {can(PERMISSIONS.financeManage) && e.is_active ? (
        <Card>
          <CardHeader
            title="Ajukan pencatatan / perubahan gaji"
            description="Nominal tidak mengubah kontrak atau payroll lama. Persetujuan harus dilakukan pengguna lain."
          />
          <CardBody>
            <form
              action={requestSalaryAction}
              className="grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="employeeId" value={id} />
              <label className="grid gap-1 text-sm">
                Gaji pokok baru (Rp)
                <input
                  required
                  name="amount"
                  inputMode="decimal"
                  placeholder="1900000"
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Tanggal berlaku
                <input
                  required
                  type="date"
                  name="effectiveDate"
                  min={e.join_date ?? undefined}
                  defaultValue={today}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                Alasan
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  name="reason"
                  className={inputClass}
                />
              </label>
              <p className="text-xs text-slate-500 sm:col-span-2">
                Untuk tanggal di tengah bulan, nominal ini adalah gaji pokok
                yang berlaku pada tanggal tersebut. Prorata dan rapel belum
                dihitung otomatis.
              </p>
              <div>
                <SubmitButton pendingLabel="Mengajukan...">
                  Ajukan untuk diperiksa
                </SubmitButton>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
      {can(PERMISSIONS.employeeVerify) && Boolean(e.ready) ? (
        <Card>
          <CardHeader
            title="Verifikasi kelengkapan"
            description="Konfirmasi sudah memeriksa sumber identitas dan rekening. Edit profil akan membatalkan verifikasi ini."
          />
          <CardBody>
            <form action={verifyEmployeeAction} className="grid gap-3">
              <input type="hidden" name="employeeId" value={id} />
              <label className="grid gap-1 text-sm">
                Catatan pemeriksaan
                <input
                  name="note"
                  required
                  minLength={5}
                  maxLength={500}
                  className={inputClass}
                />
              </label>
              <div>
                <SubmitButton>Verifikasi kelengkapan</SubmitButton>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardHeader
          title="Riwayat dan pengajuan gaji"
          description="Maksimal 100 catatan terbaru. Riwayat disetujui tidak dapat diedit atau dihapus."
        />
        <CardBody>
          <div className="space-y-4">
            {changes.length ? (
              changes.map((s) => (
                <article
                  key={s.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {money(s.amount)} · berlaku {s.effective_date}
                      </p>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        {s.reason}
                      </p>
                    </div>
                    <Badge
                      tone={
                        s.status === "PENDING"
                          ? "warning"
                          : s.status === "APPROVED"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {labels[s.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Diajukan {s.requester}
                    {s.decider ? ` · Diputuskan ${s.decider}` : ""}
                  </p>
                  {s.decision_note && (
                    <p className="mt-1 break-words text-sm">
                      Catatan: {s.decision_note}
                    </p>
                  )}
                  {s.effective_date <
                    String(
                      s.requested_at instanceof Date
                        ? s.requested_at.toISOString()
                        : s.requested_at,
                    ).slice(0, 10) && (
                    <p className="mt-2 text-sm text-amber-700">
                      Berlaku surut: periksa kebutuhan rapel dan pembayaran
                      sebelumnya.
                    </p>
                  )}
                  {s.status === "PENDING" &&
                  ((can(PERMISSIONS.financeApprove) &&
                    s.requested_by !== actor.id) ||
                    (can(PERMISSIONS.financeManage) &&
                      s.requested_by === actor.id)) ? (
                    <form
                      action={decideSalaryAction}
                      className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
                    >
                      <input type="hidden" name="id" value={s.id} />
                      <label className="grid gap-1 text-sm">
                        Catatan keputusan
                        <input
                          name="note"
                          required
                          minLength={5}
                          maxLength={1000}
                          className={inputClass}
                        />
                      </label>
                      <div className="flex flex-wrap items-end gap-2">
                        {s.requested_by === actor.id ? (
                          <SubmitButton
                            name="decision"
                            value="CANCELLED"
                            variant="secondary"
                          >
                            Batalkan pengajuan
                          </SubmitButton>
                        ) : (
                          <>
                            <SubmitButton
                              name="decision"
                              value="REJECTED"
                              variant="secondary"
                            >
                              Tolak
                            </SubmitButton>
                            <SubmitButton name="decision" value="APPROVED">
                              Setujui
                            </SubmitButton>
                          </>
                        )}
                      </div>
                    </form>
                  ) : null}
                  {s.status === "PENDING" && s.requested_by === actor.id ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Menunggu pemeriksa lain; pengaju tidak dapat menyetujui
                      sendiri.
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Belum ada pencatatan gaji. Mulai dari nominal dan tanggal
                berlaku yang sudah dikonfirmasi.
              </p>
            )}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Riwayat penempatan"
          description="Baseline hanya menyatakan kondisi saat dicatat, bukan bukti penempatan sebelum tanggal tersebut."
        />
        <CardBody>
          <div className="space-y-3">
            {data.placements.map((h, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 p-3 text-sm"
              >
                <p className="font-semibold">
                  {h.effective_date} · {h.company_name ?? "CV belum ditentukan"}{" "}
                  / {h.brand_name}
                </p>
                <p>
                  {h.location_name} · {h.position_name}
                </p>
                <p className="mt-1 break-words text-xs text-slate-500">
                  {h.reason}
                </p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
