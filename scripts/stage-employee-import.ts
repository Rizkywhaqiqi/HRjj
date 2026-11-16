import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  createConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { createBlindIndex, encryptField } from "../src/core/crypto/field-encrypt";
import { getDbEnv } from "../src/core/env";

const MAX_ROWS = 500;
const NAME_HEADER = "Nama Lengkap Karyawan?";
const LOCATION_HEADER = "Penempatan Kerja?";
const NIK_HEADER = "NIK";
const POSITION_HEADER = "Posisi?";

interface StagedRow {
  sourceRowNumber: number;
  fullName: string;
  payload: Record<string, string | null>;
  locationName: string | null;
  nik: string | null;
  nikIsNumeric: boolean;
  formulaFound: boolean;
}

interface NikHashRow extends RowDataPacket {
  nik_hash: string;
}

function getWorkbookPath(args: string[]): string {
  const fileIndex = args.indexOf("--file");
  const filePath = fileIndex >= 0 ? args[fileIndex + 1] : undefined;

  if (!filePath || filePath.startsWith("--")) {
    throw new Error(
      "Usage: npm run db:stage-employees -- --file <local-workbook.xlsx>",
    );
  }

  return path.resolve(filePath);
}

function isLocalHost(host: string): boolean {
  return ["localhost", "127.0.0.1", "::1"].includes(host.trim().toLowerCase());
}

function isFormulaCell(cell: ExcelJS.Cell): boolean {
  const value = cell.value;
  return (
    typeof value === "object" &&
    value !== null &&
    ("formula" in value || "sharedFormula" in value)
  );
}

function readCellText(cell: ExcelJS.Cell): string | null {
  const text = cell.text;
  return text === "" ? null : text;
}

async function readWorkbook(
  filePath: string,
): Promise<{ sourceHash: string; rows: StagedRow[]; locations: string[] }> {
  const file = await readFile(filePath);
  const sourceHash = createHash("sha256").update(file).digest("hex");
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error ExcelJS accepts the runtime Buffer returned by readFile.
  await workbook.xlsx.load(file);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Workbook tidak memiliki sheet.");
  }

  const headers = new Map<number, string>();
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = cell.text.trim();
    if (header) headers.set(columnNumber, header);
  });

  const columnFor = (headerName: string): number | undefined =>
    [...headers.entries()].find(([, header]) => header === headerName)?.[0];
  const nameColumn = columnFor(NAME_HEADER);
  const locationColumn = columnFor(LOCATION_HEADER);
  const nikColumn = columnFor(NIK_HEADER);
  const positionColumn = columnFor(POSITION_HEADER);

  if (
    nameColumn === undefined ||
    locationColumn === undefined ||
    nikColumn === undefined ||
    positionColumn === undefined
  ) {
    throw new Error("Header workbook tidak sesuai dengan format yang diharapkan.");
  }

  const rows: StagedRow[] = [];
  const locations = new Set<string>();

  sheet.eachRow((row, sourceRowNumber) => {
    if (sourceRowNumber === 1) return;

    const fullName = row.getCell(nameColumn).text.trim();
    if (!fullName) return;
    if (fullName.length > 150) {
      throw new Error(`Nama pada baris ${sourceRowNumber} melebihi 150 karakter.`);
    }

    const payload: Record<string, string | null> = {};
    let formulaFound = false;
    for (const [columnNumber, header] of headers) {
      const cell = row.getCell(columnNumber);
      formulaFound ||= isFormulaCell(cell);
      payload[header] = readCellText(cell);
    }

    const locationName = row.getCell(locationColumn).text.trim() || null;
    if (locationName) {
      if (locationName.length > 150) {
        throw new Error(`Nama lokasi pada baris ${sourceRowNumber} melebihi 150 karakter.`);
      }
      locations.add(locationName);
    }

    const nikCell = row.getCell(nikColumn);
    const nik = nikCell.text.trim() || null;
    const positionName = row.getCell(positionColumn).text.trim();
    rows.push({
      sourceRowNumber,
      fullName,
      payload,
      locationName,
      nik,
      nikIsNumeric: typeof nikCell.value === "number",
      formulaFound,
    });

    if (positionName.length > 120) {
      throw new Error(`Nama jabatan pada baris ${sourceRowNumber} terlalu panjang.`);
    }
  });

  if (rows.length > MAX_ROWS) {
    throw new Error(`Maksimal ${MAX_ROWS} baris per import.`);
  }

  return { sourceHash, rows, locations: [...locations] };
}

function reviewFlags(
  row: StagedRow,
  duplicateNiks: Set<string>,
  existingNiks: Set<string>,
): string[] {
  const flags = [
    "COMPANY_MAPPING_PENDING",
    "POSITION_MAPPING_PENDING",
    "LOCATION_MAPPING_PENDING",
  ];

  if (!row.nik) {
    flags.push("NIK_MISSING");
  } else if (row.nikIsNumeric) {
    flags.push("NIK_NUMERIC_EXCEL_REVIEW");
  } else if (!/^\d{16}$/.test(row.nik)) {
    flags.push("NIK_INVALID_FORMAT");
  } else {
    const hash = createBlindIndex(row.nik);
    if (duplicateNiks.has(hash)) flags.push("NIK_DUPLICATE_IN_SOURCE");
    if (existingNiks.has(hash)) flags.push("NIK_ALREADY_IN_EMPLOYEE_TABLE");
  }

  if (row.formulaFound) flags.push("FORMULA_CELL_REVIEW");
  return flags;
}

async function importStaging(filePath: string): Promise<void> {
  const env = getDbEnv();
  if (!isLocalHost(env.DB_HOST)) {
    throw new Error("Refusing to import personal data unless DB_HOST is localhost.");
  }

  const workbook = await readWorkbook(filePath);
  if (workbook.rows.length === 0) {
    throw new Error("Tidak ada baris bernama untuk dimasukkan ke staging.");
  }

  const validTextNikHashes = workbook.rows
    .filter((row) => row.nik && !row.nikIsNumeric && /^\d{16}$/.test(row.nik))
    .map((row) => createBlindIndex(row.nik as string));
  const hashCounts = new Map<string, number>();
  for (const hash of validTextNikHashes) {
    hashCounts.set(hash, (hashCounts.get(hash) ?? 0) + 1);
  }
  const duplicateNiks = new Set(
    [...hashCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([hash]) => hash),
  );

  const connection = await createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: "utf8mb4",
  });

  let inserted = 0;
  let locationsCreated = 0;

  try {
    await connection.beginTransaction();

    const existingNiks = new Set<string>();
    const distinctNikHashes = [...new Set(validTextNikHashes)];
    for (let index = 0; index < distinctNikHashes.length; index += 500) {
      const batch = distinctNikHashes.slice(index, index + 500);
      if (batch.length === 0) continue;

      const placeholders = batch.map(() => "?").join(", ");
      const [matches] = await connection.execute<NikHashRow[]>(
        `SELECT nik_hash FROM employees WHERE nik_hash IN (${placeholders})`,
        batch,
      );
      for (const match of matches) existingNiks.add(match.nik_hash);
    }

    for (const locationName of workbook.locations) {
      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT IGNORE INTO locations (brand_id, name, is_active) VALUES (NULL, ?, FALSE)",
        [locationName],
      );
      locationsCreated += result.affectedRows;
    }

    for (const row of workbook.rows) {
      const flags = reviewFlags(row, duplicateNiks, existingNiks);
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO employee_import_staging
           (source_sha256, source_row_number, full_name, payload_encrypted, review_flags)
         VALUES (?, ?, ?, ?, ?)`,
        [
          workbook.sourceHash,
          row.sourceRowNumber,
          row.fullName,
          encryptField(JSON.stringify(row.payload)),
          JSON.stringify(flags),
        ],
      );
      inserted += result.affectedRows;
    }

    await connection.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (NULL, 'employee.staging_import', 'employee_import_staging', NULL, ?)`,
      [
        JSON.stringify({
          sourceSha256: workbook.sourceHash,
          rows: inserted,
          locationsCreated,
        }),
      ],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  console.info(
    JSON.stringify({
      sourceRows: workbook.rows.length,
      stagedRowsInserted: inserted,
      stagedRowsAlreadyPresent: workbook.rows.length - inserted,
      inactiveLocationsCreated: locationsCreated,
    }),
  );
}

void Promise.resolve()
  .then(() => importStaging(getWorkbookPath(process.argv.slice(2))))
  .catch((error: unknown) => {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    console.error("[employee-staging] Import failed.", {
      reason: error instanceof Error ? error.message : "Unknown error",
      code,
    });
    process.exitCode = 1;
  });
