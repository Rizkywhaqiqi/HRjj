import { SubmitButton } from "@/components/ui/form";
import { Pagination, parsePage } from "@/components/shared/pagination";
import { countContracts } from "@/modules/contracts/queries";
import Link from "next/link";
import { contractReminder } from "@/modules/contracts/reminders";
import { listLetterEmployees } from "@/modules/letters";
import {
  hasPermission,
  isFeatureEnabled,
  requireFeatureEnabled,
  requirePermission,
} from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import {
  listContracts,
  getContractEmployeeContext,
  createContractAction,
  decideContractAction,
} from "@/modules/contracts";
import { listContractTypes, listExitReasons } from "@/modules/master-data";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Badge,
  inputClass,
  buttonPrimary,
  buttonSecondary,
} from "@/components/ui/primitives";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import { firstParam, formatDate } from "@/components/shared/format";

export const instant = false;

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.contractView);
  await requireFeatureEnabled("contracts");
  const params = await searchParams;
  const page = parsePage(params.page);
  const total = await countContracts(actor);
  const rawEmployeeId = firstParam(params.employeeId);
  const parsedEmployeeId = Number(rawEmployeeId);
  const selectedEmployeeId =
    Number.isSafeInteger(parsedEmployeeId) && parsedEmployeeId > 0
      ? parsedEmployeeId
      : null;
  const [
    contracts,
    contractTypes,
    exitReasons,
    selectedEmployee,
    employeeOptions,
  ] = await Promise.all([
    listContracts(actor, page, 25),
    listContractTypes(),
    listExitReasons(),
    selectedEmployeeId
      ? getContractEmployeeContext(actor, selectedEmployeeId)
      : Promise.resolve(null),
    listLetterEmployees(actor),
  ]);
  const canCreate = hasPermission(actor, PERMISSIONS.contractCreate);
  const canDecide = hasPermission(actor, PERMISSIONS.contractDecide);
  const canViewLetter =
    hasPermission(actor, PERMISSIONS.letterView) &&
    (await isFeatureEnabled("letters"));
  const canCreateLetter =
    canViewLetter && hasPermission(actor, PERMISSIONS.letterCreate);
  return (
    <div>
      <PageHeader
        title="Kontrak kerja"
        description="Pantau masa kontrak, catat perpanjangan, dan tindak lanjuti pengingat di dashboard."
      />
      <FlashAlerts {...readFlash(params)} />
      {canCreate ? (
        selectedEmployeeId && !selectedEmployee ? (
          <Card className="mb-5">
            <CardBody>
              <p className="text-sm text-rose-700">
                Karyawan aktif tidak ditemukan atau berada di luar akses Anda.
              </p>
              <Link href="/employees" className={`${buttonSecondary} mt-3`}>
                Pilih karyawan
              </Link>
            </CardBody>
          </Card>
        ) : selectedEmployee && selectedEmployee.company_name === null ? (
          <Card className="mb-5">
            <CardBody>
              <p className="text-sm text-amber-800">
                CV karyawan belum ditentukan. Pilih CV melalui edit profil
                sebelum membuat kontrak.
              </p>
              <Link
                href={`/employees/${selectedEmployee.id}?mode=edit`}
                className={`${buttonSecondary} mt-3`}
              >
                Lengkapi profil karyawan
              </Link>
            </CardBody>
          </Card>
        ) : (
          <Card className="mb-5">
            <CardHeader
              title="Tambah kontrak"
              description={
                selectedEmployee
                  ? "Data kontrak akan disimpan, lalu Anda dapat menyiapkan surat kontraknya."
                  : undefined
              }
            />
            <CardBody>
              <form
                action={createContractAction}
                className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5"
              >
                {selectedEmployee ? (
                  <>
                    <input
                      name="employeeId"
                      type="hidden"
                      value={selectedEmployee.id}
                    />
                    <input name="continueToLetter" type="hidden" value="1" />
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm sm:col-span-2 2xl:col-span-5">
                      <p className="font-semibold text-slate-900">
                        {selectedEmployee.full_name} ·{" "}
                        {selectedEmployee.employee_code}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedEmployee.company_name}
                      </p>
                    </div>
                  </>
                ) : (
                  <label className="text-sm font-medium text-slate-700">
                    Karyawan
                    <select name="employeeId" required className={inputClass}>
                      <option value="">Pilih karyawan</option>
                      {employeeOptions.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name} · {e.employee_code}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <select
                  name="contractTypeId"
                  required
                  defaultValue={
                    selectedEmployee
                      ? contractTypes.find(
                          (item) =>
                            item.default_months === 2 && !item.is_permanent,
                        )?.id
                      : undefined
                  }
                  className={inputClass}
                >
                  <option value="">Jenis kontrak</option>
                  {contractTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Tanggal mulai
                  <input
                    name="startDate"
                    type="date"
                    required
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Tanggal akhir
                  <input name="endDate" type="date" className={inputClass} />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Gaji pokok (Rp)
                  <input
                    name="baseSalary"
                    type="number"
                    min="0"
                    placeholder="Gaji pokok"
                    className={inputClass}
                  />
                </label>
                <SubmitButton
                  unstyled
                  className={`${buttonPrimary} sm:col-span-2 2xl:col-span-5`}
                >
                  {selectedEmployee
                    ? "Simpan kontrak & lanjut ke surat"
                    : "Simpan kontrak"}
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        )
      ) : null}
      <Card>
        <CardBody>
          <div className="responsive-table-wrap overflow-x-auto">
            <table
              role="table"
              className="responsive-data-table w-full min-w-[1050px] text-left text-sm"
            >
              <thead
                role="rowgroup"
                className="border-b border-slate-200 text-xs uppercase text-slate-500"
              >
                <tr role="row">
                  <th scope="col" className="px-3 py-2">
                    Karyawan
                  </th>
                  <th scope="col" className="px-3 py-2">
                    CV / Brand
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Jenis
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Periode
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Surat
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Keputusan
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {contracts.map((item) => (
                  <tr
                    role="row"
                    key={item.id}
                    className="border-b border-slate-100 align-top"
                  >
                    <td role="cell" className="px-3 py-3">
                      <span className="mobile-cell-label" aria-hidden="true">
                        Karyawan
                      </span>
                      <b>{item.full_name}</b>
                      <div className="text-xs text-slate-500">
                        {item.employee_code}
                      </div>
                    </td>
                    <td role="cell" className="px-3 py-3">
                      <span className="mobile-cell-label" aria-hidden="true">
                        CV / Brand
                      </span>
                      {item.company_name}
                      <div className="text-xs text-slate-500">
                        {item.brand_name}
                      </div>
                    </td>
                    <td role="cell" className="px-3 py-3">
                      <span className="mobile-cell-label" aria-hidden="true">
                        Jenis
                      </span>
                      {item.contract_type_name}
                    </td>
                    <td role="cell" className="px-3 py-3">
                      <span className="mobile-cell-label" aria-hidden="true">
                        Periode
                      </span>
                      {formatDate(item.start_date)} —{" "}
                      {item.end_date ? formatDate(item.end_date) : "Tetap"}
                      {item.status === "RUNNING" ? (
                        <div className="mt-2">
                          <Badge
                            tone={
                              contractReminder(
                                item.days_remaining === null
                                  ? null
                                  : Number(item.days_remaining),
                              ).tone
                            }
                          >
                            {
                              contractReminder(
                                item.days_remaining === null
                                  ? null
                                  : Number(item.days_remaining),
                              ).label
                            }
                          </Badge>
                        </div>
                      ) : null}
                    </td>
                    <td role="cell" className="px-3 py-3">
                      <span className="mobile-cell-label" aria-hidden="true">
                        Status
                      </span>
                      <Badge
                        tone={item.status === "RUNNING" ? "success" : "neutral"}
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td role="cell" className="px-3 py-3">
                      <span className="mobile-cell-label" aria-hidden="true">
                        Surat
                      </span>
                      <div className="flex flex-col items-start gap-1">
                        {item.letter_id && canViewLetter ? (
                          <Link
                            href={`/letters/${item.letter_id}/preview`}
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            Lihat surat kontrak
                          </Link>
                        ) : item.letter_id ? (
                          "Tersedia"
                        ) : null}
                        {!item.letter_id &&
                        canCreateLetter &&
                        item.status === "RUNNING" ? (
                          <Link
                            href={`/letters?employeeId=${item.employee_id}&contractId=${item.id}&type=CONTRACT`}
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            Buat surat kontrak ini
                          </Link>
                        ) : null}
                        {canCreateLetter &&
                        canCreate &&
                        canDecide &&
                        item.status === "RUNNING" &&
                        item.end_date ? (
                          <Link
                            href={`/letters?employeeId=${item.employee_id}&contractId=${item.id}&type=CONTRACT&flow=renewal`}
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            Buat surat perpanjangan
                          </Link>
                        ) : null}
                        {!item.letter_id &&
                        !(
                          canCreateLetter &&
                          item.status === "RUNNING" &&
                          item.end_date
                        )
                          ? "Belum dibuat"
                          : null}
                      </div>
                    </td>
                    <td role="cell" className="px-3 py-3">
                      <span className="mobile-cell-label" aria-hidden="true">
                        Keputusan
                      </span>
                      {canDecide && item.status === "RUNNING" ? (
                        <details>
                          <summary className="cursor-pointer text-xs font-semibold text-brand-700">
                            Pilih keputusan
                          </summary>
                          <form
                            action={decideContractAction}
                            className="mt-2 grid gap-2"
                          >
                            <input
                              type="hidden"
                              name="contractId"
                              value={item.id}
                            />
                            <select
                              name="decision"
                              required
                              defaultValue=""
                              className={inputClass}
                            >
                              <option value="" disabled>
                                Pilih keputusan
                              </option>
                              <option value="PERMANENT">Jadikan tetap</option>
                              <option value="NOT_EXTEND">
                                Tidak diperpanjang
                              </option>
                            </select>
                            <p className="text-xs text-slate-500">
                              Untuk perpanjangan, gunakan Buat surat
                              perpanjangan pada kolom Surat. Keputusan keluar
                              hanya setelah kontrak berakhir.
                            </p>
                            <select name="exitReasonId" className={inputClass}>
                              <option value="">Alasan keluar bila perlu</option>
                              {exitReasons.map((reason) => (
                                <option key={reason.id} value={reason.id}>
                                  {reason.name}
                                </option>
                              ))}
                            </select>
                            <SubmitButton
                              unstyled
                              className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
                            >
                              Simpan keputusan
                            </SubmitButton>
                          </form>
                        </details>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={25}
            total={total}
            basePath="/contracts"
            query={{
              employeeId: selectedEmployeeId
                ? String(selectedEmployeeId)
                : undefined,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
