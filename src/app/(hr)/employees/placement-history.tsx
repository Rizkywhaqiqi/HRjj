import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { directBrandScope } from "@/core/rbac/scope";
import { PERMISSIONS } from "@/core/rbac/permissions";
import type { SessionUser } from "@/types/database";
import {
  listBrandOptions,
  listCompanyOptions,
  listPositionOptions,
  listLocations,
} from "@/modules/master-data";
import { jakartaToday } from "@/modules/finance/policy";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import PlacementForm from "./placement-form";
export default async function PlacementHistory({
  actor,
  id,
  active,
}: {
  actor: SessionUser;
  id: number;
  active: boolean;
}) {
  const scope = directBrandScope(actor, "e.brand_id");
  const rows = await queryRows<RowDataPacket>(
    `SELECT h.id,DATE_FORMAT(h.effective_date,'%Y-%m-%d') effective_date,h.company_name,h.brand_name,h.position_name,h.location_name,h.reason FROM employee_placements h JOIN employees e ON e.id=h.employee_id WHERE e.id=? AND ${scope.clause} ORDER BY h.effective_date DESC,h.id DESC LIMIT 100`,
    [id, ...scope.params],
  );
  const canTransfer =
    active &&
    actor.permissions.includes(PERMISSIONS.employeeUpdate) &&
    actor.permissions.includes(PERMISSIONS.employeeViewPrivateFields);
  const options = canTransfer
    ? await Promise.all([
        listBrandOptions(actor),
        listCompanyOptions(actor),
        listPositionOptions(),
        listLocations(actor),
      ])
    : null;
  return (
    <>
      <Card>
        <CardHeader
          title="Riwayat penempatan"
          description="Maksimal 100 catatan terbaru. Baseline hanya berlaku sejak tanggal pencatatan; riwayat lama tidak direka ulang."
        />
        <CardBody>
          <div className="space-y-3">
            {rows.length ? (
              rows.map((h) => (
                <div
                  key={h.id}
                  className="rounded-xl border border-slate-200 p-3 text-sm"
                >
                  <p className="font-semibold">
                    {h.effective_date} ·{" "}
                    {h.company_name ?? "CV belum ditentukan"} / {h.brand_name}
                  </p>
                  <p>
                    {h.location_name} · {h.position_name}
                  </p>
                  <p className="mt-1 break-words text-xs text-slate-500">
                    {h.reason}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Belum ada riwayat penempatan tercatat.
              </p>
            )}
          </div>
        </CardBody>
      </Card>
      {options && (
        <Card>
          <CardHeader
            title="Mutasi penempatan"
            description="Perubahan CV, brand, jabatan, dan outlet dicatat melalui alur ini agar riwayat tetap tersedia."
          />
          <CardBody>
            <PlacementForm
              id={id}
              today={jakartaToday()}
              brands={options[0]}
              companies={options[1]}
              positions={options[2]}
              locations={options[3]}
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}
