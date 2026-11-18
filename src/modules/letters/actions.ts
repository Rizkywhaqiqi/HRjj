"use server";
import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "@/core/db";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { directBrandScope } from "@/core/rbac/scope";
import { logAudit } from "@/core/audit/log";
import { firstIssueMessage, redirectWithMessage } from "@/core/http/navigation";
import { letterCreateSchema } from "./schema";
import { assertNoContractOverlap } from "@/modules/contracts/overlap";
import { validateContractPeriod } from "@/modules/contracts/policy";
import { createSnapshot } from "./templates";
export async function createLetterAction(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.letterCreate);
  await requireFeatureEnabled("letters");
  const parsed = letterCreateSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success)
    redirectWithMessage("/letters", "error", firstIssueMessage(parsed.error));
  const d = parsed.data;
  if (d.type === "CONTRACT") {
    await requireFeatureEnabled("contracts");
    if (!d.contractId) await requirePermission(PERMISSIONS.contractCreate);
    if (d.previousContractId)
      await requirePermission(PERMISSIONS.contractDecide);
  }
  let trackedContractId: number | undefined = d.contractId;
  const scope = directBrandScope(actor, "e.brand_id");
  let letterId: number;
  try {
    letterId = await withTransaction(async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT e.id,e.employee_code,e.full_name,e.is_active,e.company_id,DATE_FORMAT(e.join_date,'%Y-%m-%d') join_date,DATE_FORMAT(e.exit_date,'%Y-%m-%d') exit_date,c.name company_name,b.code brand_code,p.name position_name,l.name location_name FROM employees e LEFT JOIN companies c ON c.id=e.company_id INNER JOIN brands b ON b.id=e.brand_id INNER JOIN positions p ON p.id=e.position_id INNER JOIN locations l ON l.id=e.location_id WHERE e.id=? AND ${scope.clause} LIMIT 1 FOR UPDATE`,
        [d.employeeId, ...scope.params],
      );
      const e = rows[0];
      if (!e)
        throw new Error("Karyawan tidak ditemukan atau di luar akses Anda.");
      if (!e.company_id)
        throw new Error("Lengkapi perusahaan karyawan sebelum membuat surat.");
      if (d.type === "STILL_WORKING" && !e.is_active)
        throw new Error("Surat masih bekerja hanya untuk karyawan aktif.");
      if (
        ["SKK", "STILL_WORKING"].includes(d.type) &&
        !d.startDate &&
        !e.join_date
      )
        throw new Error("Lengkapi tanggal bergabung atau tanggal mulai surat.");
      if (d.type === "SKK" && !e.is_active && !d.endDate && !e.exit_date)
        throw new Error("Tanggal akhir bekerja wajib untuk karyawan nonaktif.");
      const [contracts] = d.contractId
        ? await connection.execute<RowDataPacket[]>(
            `SELECT id,letter_id,DATE_FORMAT(start_date,'%Y-%m-%d') start_date,DATE_FORMAT(end_date,'%Y-%m-%d') end_date,base_salary FROM contracts WHERE id=? AND employee_id=? AND status='RUNNING' FOR UPDATE`,
            [d.contractId, d.employeeId],
          )
        : [[], []];
      if (d.contractId && (d.type !== "CONTRACT" || !contracts[0]))
        throw new Error("Kontrak tidak valid untuk karyawan ini.");
      if (d.contractId && contracts[0]?.letter_id)
        throw new Error(
          "Kontrak sudah memiliki surat. Buka riwayat untuk mengunduh ulang.",
        );
      if (
        d.contractId &&
        (d.startDate !== contracts[0].start_date ||
          (d.endDate ?? null) !== contracts[0].end_date ||
          (contracts[0].base_salary !== null &&
            d.salary !== Number(contracts[0].base_salary)))
      )
        throw new Error(
          "Tanggal dan gaji surat harus sesuai data kontrak. Perbarui kontrak terlebih dahulu.",
        );
      if (d.type === "CONTRACT" && !d.contractId) {
        if (!e.is_active)
          throw new Error("Kontrak baru hanya untuk karyawan aktif.");
        const [types] = await connection.execute<RowDataPacket[]>(
          "SELECT is_permanent FROM contract_types WHERE id=? AND is_active=TRUE",
          [d.contractTypeId!],
        );
        if (!types[0])
          throw new Error("Jenis kontrak tidak aktif atau tidak ditemukan.");
        let previousEnd: string | null | undefined;
        if (d.previousContractId) {
          const [previous] = await connection.execute<RowDataPacket[]>(
            "SELECT DATE_FORMAT(end_date,'%Y-%m-%d') end_date FROM contracts WHERE id=? AND employee_id=? AND status='RUNNING' FOR UPDATE",
            [d.previousContractId, d.employeeId],
          );
          if (!previous[0])
            throw new Error(
              "Kontrak lama sudah diputuskan atau tidak sesuai karyawan.",
            );
          previousEnd = previous[0].end_date;
        }
        validateContractPeriod(
          d.startDate!,
          d.endDate ?? null,
          types[0].is_permanent === 1,
          previousEnd,
        );
        await assertNoContractOverlap(
          connection,
          d.employeeId,
          d.startDate!,
          d.endDate ?? null,
          d.previousContractId,
        );
        if (d.previousContractId)
          await connection.execute("UPDATE contracts SET status=? WHERE id=?", [
            types[0].is_permanent ? "MADE_PERMANENT" : "EXTENDED",
            d.previousContractId,
          ]);
        const [created] = await connection.execute<ResultSetHeader>(
          "INSERT INTO contracts (employee_id,contract_type_id,previous_contract_id,start_date,end_date,base_salary,status) VALUES (?,?,?,?,?,?,'RUNNING')",
          [
            d.employeeId,
            d.contractTypeId!,
            d.previousContractId ?? null,
            d.startDate!,
            d.endDate ?? null,
            d.salary!,
          ],
        );
        trackedContractId = created.insertId;
      }
      const year = Number(d.issuedDate.slice(0, 4));
      await connection.execute(
        "INSERT INTO letter_sequences (company_id,letter_year,next_number) VALUES (?,?,1) ON DUPLICATE KEY UPDATE next_number=next_number",
        [e.company_id, year],
      );
      const [seq] = await connection.execute<RowDataPacket[]>(
        "SELECT next_number FROM letter_sequences WHERE company_id=? AND letter_year=? FOR UPDATE",
        [e.company_id, year],
      );
      await connection.execute(
        "UPDATE letter_sequences SET next_number=next_number+1 WHERE company_id=? AND letter_year=?",
        [e.company_id, year],
      );
      const number = `${e.brand_code}/CV${e.company_id}/${d.type}/${year}/${String(seq[0].next_number).padStart(4, "0")}`;
      const snapshot = createSnapshot({
        type: d.type,
        fullName: String(e.full_name),
        employeeCode: String(e.employee_code),
        company: String(e.company_name),
        position: String(e.position_name),
        location: String(e.location_name),
        issuedDate: d.issuedDate,
        joinDate: e.join_date ?? "Belum diisi",
        startDate: d.startDate ?? "",
        endDate:
          d.endDate ??
          (d.type === "SKK" && !e.is_active ? e.exit_date : "") ??
          "",
        salary: new Intl.NumberFormat("id-ID").format(d.salary ?? 0),
        purpose: d.purpose,
        warningLevel: d.warningLevel,
        incident: d.incident,
        terms: d.terms,
        signatory: d.signatory,
      });
      const [r] = await connection.execute<ResultSetHeader>(
        "INSERT INTO letters (letter_number,type,employee_id,company_id,template_id,file_path,status,issued_date,metadata,created_by) VALUES (?,?,?,?,NULL,?,'ISSUED',?,?,?)",
        [
          number,
          d.type,
          d.employeeId,
          e.company_id,
          `snapshot:v1:${randomUUID()}`,
          d.issuedDate,
          JSON.stringify({ snapshot }),
          actor.id,
        ],
      );
      if (trackedContractId)
        await connection.execute(
          "UPDATE contracts SET letter_id=?, base_salary=COALESCE(base_salary,?) WHERE id=?",
          [r.insertId, d.salary!, trackedContractId],
        );
      return r.insertId;
    });
  } catch (error) {
    redirectWithMessage(
      "/letters",
      "error",
      error instanceof Error && !("code" in error)
        ? error.message
        : "Surat gagal disimpan. Periksa data dan coba lagi.",
    );
  }
  if (trackedContractId && !d.contractId) {
    await logAudit({
      userId: actor.id,
      action: "contract.create",
      entityType: "contract",
      entityId: trackedContractId,
      details: {
        employeeId: d.employeeId,
        previousContractId: d.previousContractId ?? null,
        letterId,
      },
    });
    if (d.previousContractId)
      await logAudit({
        userId: actor.id,
        action: "contract.decision",
        entityType: "contract",
        entityId: d.previousContractId,
        details: { nextContractId: trackedContractId, letterId },
      });
  }
  await logAudit({
    userId: actor.id,
    action: "letter.create",
    entityType: "letter",
    entityId: letterId,
    details: { type: d.type, storage: "snapshot", version: 1 },
  });
  redirectWithMessage(
    `/letters/${letterId}/preview`,
    "ok",
    "Riwayat surat tersimpan. PDF dapat diunduh kapan saja.",
  );
}
