import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  createConnection,
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import {
  createBlindIndex,
  decryptField,
  encryptField,
} from "../src/core/crypto/field-encrypt";
import { getDbEnv } from "../src/core/env";
import { normalizePhone } from "../src/core/normalization";
import { parseExcelDate } from "../src/modules/employees/import-date";
import {
  insertEmployeeRecord,
  type EmployeeRecordInput,
} from "../src/modules/employees/insert-employee";

const MAX_ROWS = 500;
const PLACEHOLDER_BRAND_CODE = "UNASSIGNED";
const PLACEHOLDER_BRAND_NAME = "Belum Ditentukan";

const HEADERS = {
  name: "Nama Lengkap Karyawan?",
  location: "Penempatan Kerja?",
  position: "Posisi?",
  birth: "Tempat, Tanggal Lahir",
  joinDate: "Tanggal Mulai Bergabung di Perusahaan?",
  nik: "NIK",
  status: "Status",
  currentAddress: "Alamat Tinggal Saat ini?",
  ktpAddress: "Alamat Sesuai KTP?",
  email: "Email?",
  phone: "Nomor Handphone",
  npwp: "NPWP",
  bankAccount: "Nomor Rekening?",
  children: "Jika sudah menikah, sudah mempunyai berapa anak?",
} as const;

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

interface SourceRow {
  sourceRowNumber: number;
  fullName: string;
  locationName: string;
  positionName: string;
  payload: Record<string, string | null>;
  values: Map<string, unknown>;
  numericFields: Set<string>;
  birthPlace: string | null;
  birthDate: string | null;
  joinDate: string | null;
  nik: string | null;
  maritalStatus: EmployeeRecordInput["maritalStatus"];
  addressCurrent: string | null;
  addressKtp: string | null;
  email: string | null;
  phone: string | null;
  npwp: string | null;
  bankAccountNumber: string | null;
  childrenCount: number | null;
}

interface StagingRow extends RowDataPacket {
  id: number;
  source_sha256: string;
  source_row_number: number;
  full_name: string;
  payload_encrypted: string;
  status: "PENDING" | "PROMOTED" | "DISCARDED";
  employee_id: number | null;
}

interface BrandRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  is_active: 0 | 1;
}

interface DivisionRow extends RowDataPacket {
  id: number;
  name: string;
}

interface PositionRow extends RowDataPacket {
  id: number;
  division_id: number;
  name: string;
  is_active: 0 | 1;
}

interface LocationRow extends RowDataPacket {
  id: number;
  name: string;
  is_active: 0 | 1;
}

interface EmployeeNikRow extends RowDataPacket {
  id: number;
  nik_hash: string | null;
}

interface EmployeeNameRow extends RowDataPacket {
  id: number;
  full_name: string;
}

function isLocalHost(host: string): boolean {
  return ["localhost", "127.0.0.1", "::1"].includes(host.trim().toLowerCase());
}

function parseArgs(args: string[]): { filePath: string; commit: boolean } {
  const fileIndex = args.indexOf("--file");
  const filePath = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
  if (!filePath || filePath.startsWith("--")) {
    throw new Error(
      "Usage: npm run db:activate-employees -- --file <local-workbook.xlsx> [--commit]",
    );
  }
  return {
    filePath: path.resolve(filePath),
    commit: args.includes("--commit"),
  };
}

function cellText(cell: ExcelJS.Cell): string | null {
  const text = cell.text;
  return text === "" ? null : text;
}

function cellIsFormula(cell: ExcelJS.Cell): boolean {
  const value = cell.value;
  return typeof value === "object" && value !== null &&
    ("formula" in value || "sharedFormula" in value);
}

function parseBirthDate(value: string | null, date1904: boolean): {
  place: string | null;
  date: string | null;
} {
  if (!value) return { place: null, date: null };
  const comma = value.lastIndexOf(",");
  if (comma < 1) return { place: null, date: null };

  const place = value.slice(0, comma).trim();
  const dateText = value.slice(comma + 1).trim();
  let date = parseExcelDate(dateText, date1904);
  if (!date) {
    const namedMonth = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i.exec(dateText);
    if (namedMonth) {
      const month = MONTHS[namedMonth[2].toLocaleLowerCase("id-ID")];
      if (month) {
        date = parseExcelDate(
          `${namedMonth[3]}-${month}-${namedMonth[1]}`,
          date1904,
        );
      }
    }
  }

  return date && place.length >= 2 && place.length <= 100
    ? { place, date }
    : { place: null, date: null };
}

function parseMaritalStatus(value: string | null): SourceRow["maritalStatus"] {
  const normalized = value?.trim().toLocaleLowerCase("id-ID");
  if (normalized === "belum menikah") return "SINGLE";
  if (normalized === "menikah") return "MARRIED";
  if (normalized === "cerai" || normalized === "bercerai") return "DIVORCED";
  return null;
}

function validEmail(value: string | null): string | null {
  if (!value || value.length > 150) return null;
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null;
}

function validPhone(value: string | null): string | null {
  if (!value) return null;
  const normalized = normalizePhone(value);
  return /^\+?\d{8,30}$/.test(normalized) ? normalized : null;
}

function parseChildren(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 && count <= 30 ? count : null;
}

function safeText(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

async function readWorkbook(filePath: string): Promise<{
  sourceHash: string;
  rows: SourceRow[];
}> {
  const bytes = await readFile(filePath);
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error ExcelJS accepts the Node Buffer returned by readFile.
  await workbook.xlsx.load(bytes);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Workbook tidak memiliki sheet.");

  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = cell.text.trim();
    if (header) columns.set(header, columnNumber);
  });
  for (const header of Object.values(HEADERS)) {
    if (!columns.has(header)) throw new Error("Header workbook tidak lengkap.");
  }

  const rows: SourceRow[] = [];
  const requiredHeaders = Object.values(HEADERS);
  sheet.eachRow((row, sourceRowNumber) => {
    if (sourceRowNumber === 1) return;
    const values = new Map<string, unknown>();
    const payload: Record<string, string | null> = {};
    const numericFields = new Set<string>();

    for (const [header, columnNumber] of columns) {
      const cell = row.getCell(columnNumber);
      values.set(header, cell.value);
      payload[header] = cellText(cell);
      if (typeof cell.value === "number") numericFields.add(header);
    }

    const fullName = cellText(row.getCell(columns.get(HEADERS.name)!))?.trim() || null;
    if (!fullName) return;
    if (fullName.length > 150) {
      throw new Error(`Nama pada baris ${sourceRowNumber} melebihi batas.`);
    }
    for (const header of requiredHeaders) {
      const cell = row.getCell(columns.get(header)!);
      if (cellIsFormula(cell)) {
        throw new Error(`Formula tidak diizinkan pada baris ${sourceRowNumber}.`);
      }
    }

    const get = (header: string): string | null => {
      const value = payload[header];
      return value?.trim() || null;
    };
    const locationName = get(HEADERS.location);
    const positionName = get(HEADERS.position);
    if (!locationName || !positionName) {
      throw new Error(`Penempatan atau jabatan kosong pada baris ${sourceRowNumber}.`);
    }

    const birth = parseBirthDate(get(HEADERS.birth), workbook.properties.date1904);
    const joinValue = values.get(HEADERS.joinDate);
    const nikText = get(HEADERS.nik);
    const nik = !numericFields.has(HEADERS.nik) && nikText && /^\d{16}$/.test(nikText)
      ? nikText
      : null;
    const childrenText = get(HEADERS.children);

    rows.push({
      sourceRowNumber,
      fullName,
      locationName,
      positionName,
      payload,
      values,
      numericFields,
      birthPlace: birth.place,
      birthDate: birth.date,
      joinDate: parseExcelDate(joinValue, workbook.properties.date1904),
      nik,
      maritalStatus: parseMaritalStatus(get(HEADERS.status)),
      addressCurrent: safeText(get(HEADERS.currentAddress), 2000),
      addressKtp: safeText(get(HEADERS.ktpAddress), 2000),
      email: validEmail(get(HEADERS.email)),
      phone: numericFields.has(HEADERS.phone) ? null : validPhone(get(HEADERS.phone)),
      npwp: numericFields.has(HEADERS.npwp) ? null : safeText(get(HEADERS.npwp), 50),
      bankAccountNumber: numericFields.has(HEADERS.bankAccount)
        ? null
        : safeText(get(HEADERS.bankAccount), 50),
      childrenCount: parseChildren(childrenText),
    });
  });

  if (rows.length === 0 || rows.length > MAX_ROWS) {
    throw new Error(`Jumlah baris bernama harus antara 1 dan ${MAX_ROWS}.`);
  }

  return {
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    rows,
  };
}

async function loadAndValidateStaging(
  connection: Connection,
  rows: SourceRow[],
): Promise<{ stagingByRow: Map<number, StagingRow>; previousSourceHash: string }> {
  const [stagingRows] = await connection.query<StagingRow[]>(
    `SELECT id, source_sha256, source_row_number, full_name, payload_encrypted,
            status, employee_id
     FROM employee_import_staging
     ORDER BY source_row_number`,
  );
  if (stagingRows.length !== rows.length) {
    throw new Error("Jumlah staging tidak cocok dengan workbook.");
  }

  const stagingByRow = new Map<number, StagingRow>();
  for (const staged of stagingRows) {
    if (staged.status === "DISCARDED" || stagingByRow.has(staged.source_row_number)) {
      throw new Error("Status atau nomor baris staging tidak valid.");
    }
    stagingByRow.set(staged.source_row_number, staged);
  }

  for (const row of rows) {
    const staged = stagingByRow.get(row.sourceRowNumber);
    if (!staged || staged.full_name !== row.fullName) {
      throw new Error(`Baris ${row.sourceRowNumber} tidak cocok dengan staging.`);
    }
    const payload = JSON.parse(decryptField(staged.payload_encrypted)) as Record<string, unknown>;
    if (String(payload[HEADERS.name] ?? "").trim() !== row.fullName) {
      throw new Error(`Identitas staging baris ${row.sourceRowNumber} tidak cocok.`);
    }
    if ((staged.status === "PROMOTED") !== (staged.employee_id !== null)) {
      throw new Error(`Relasi karyawan staging baris ${row.sourceRowNumber} tidak valid.`);
    }
  }

  const previousHashes = new Set(stagingRows.map((row) => row.source_sha256));
  if (previousHashes.size !== 1) {
    throw new Error("Staging memiliki lebih dari satu sumber; hentikan agar tidak tercampur.");
  }
  return {
    stagingByRow,
    previousSourceHash: [...previousHashes][0],
  };
}

function locationBrandCode(locationName: string): string {
  if (
    locationName === "Dapur Meranti" ||
    locationName === "Gudang" ||
    locationName === "Office" ||
    locationName === "Operasional Management" ||
    locationName.startsWith("JOJO x JLY")
  ) {
    return PLACEHOLDER_BRAND_CODE;
  }
  const prefix = /^(Ana|Guulak|JLY|JOJO)\b/i.exec(locationName)?.[1];
  if (!prefix) throw new Error("Brand lokasi tidak dapat dipetakan.");
  return prefix.toUpperCase();
}

function positionKey(positionName: string, locationName: string): string {
  if (positionName === "Admin") {
    const division =
      locationName === "Dapur Meranti" ? "Dapur Produksi" :
      locationName === "Gudang" ? "Gudang" :
      locationName === "Operasional Management" ? "Operasional" :
      locationName === "Office" ? "Head Office" :
      null;
    const title =
      locationName === "Dapur Meranti" ? "Admin Dapur" :
      locationName === "Gudang" ? "Admin Gudang" :
      "Admin";
    if (!division) throw new Error("Pemetaan jabatan Admin tidak dikenal.");
    return `${division}\u0000${title}`;
  }
  if (positionName === "Marketing") return `Marketing\u0000Marketing`;
  if (positionName === "Manager Area / Assistant Manager") {
    return `Operasional\u0000Manager Area / Assistant Manager`;
  }
  return `\u0000${positionName}`;
}

async function ensurePlaceholderBrand(
  connection: Connection,
  commit: boolean,
): Promise<number> {
  const [rows] = await connection.execute<BrandRow[]>(
    "SELECT id, code, name, is_active FROM brands WHERE code=? OR name=? FOR UPDATE",
    [PLACEHOLDER_BRAND_CODE, PLACEHOLDER_BRAND_NAME],
  );
  if (rows.length > 1 || (rows[0] &&
    (rows[0].code !== PLACEHOLDER_BRAND_CODE || rows[0].name !== PLACEHOLDER_BRAND_NAME))) {
    throw new Error("Kode atau nama brand placeholder sudah dipakai.");
  }
  if (rows[0]) {
    if (rows[0].is_active !== 1 && commit) {
      await connection.execute("UPDATE brands SET is_active=TRUE WHERE id=?", [rows[0].id]);
    }
    return rows[0].id;
  }
  if (!commit) return 0;

  const [result] = await connection.execute<ResultSetHeader>(
    "INSERT INTO brands (code, name, description) VALUES (?, ?, ?)",
    [
      PLACEHOLDER_BRAND_CODE,
      PLACEHOLDER_BRAND_NAME,
      "Brand sementara untuk karyawan dengan pemetaan brand sumber yang belum dipastikan.",
    ],
  );
  return result.insertId;
}

async function ensurePosition(
  connection: Connection,
  positionName: string,
  divisionId: number,
  commit: boolean,
): Promise<number> {
  const [rows] = await connection.execute<PositionRow[]>(
    "SELECT id, division_id, name, is_active FROM positions WHERE division_id=? AND name=? LIMIT 1 FOR UPDATE",
    [divisionId, positionName],
  );
  if (rows[0]) {
    if (rows[0].is_active !== 1 && commit) {
      await connection.execute("UPDATE positions SET is_active=TRUE WHERE id=?", [rows[0].id]);
    }
    return rows[0].id;
  }
  if (!commit) return 0;
  const [result] = await connection.execute<ResultSetHeader>(
    "INSERT INTO positions (division_id, name) VALUES (?, ?)",
    [divisionId, positionName],
  );
  return result.insertId;
}

async function loadOrganization(
  connection: Connection,
  rows: SourceRow[],
  commit: boolean,
): Promise<{
  placeholderBrandId: number;
  brands: Map<string, BrandRow>;
  locations: Map<string, LocationRow>;
  positions: Map<string, number>;
  divisions: Map<string, number>;
}> {
  const placeholderBrandId = await ensurePlaceholderBrand(connection, commit);
  const [brandRows] = await connection.query<BrandRow[]>(
    "SELECT id, code, name, is_active FROM brands",
  );
  const brands = new Map(brandRows.map((brand) => [brand.code, brand]));
  const [divisionRows] = await connection.query<DivisionRow[]>(
    "SELECT id, name FROM divisions",
  );
  const divisions = new Map(divisionRows.map((division) => [division.name, division.id]));
  const [locationRows] = await connection.query<LocationRow[]>(
    "SELECT id, name, is_active FROM locations",
  );
  const locations = new Map(locationRows.map((location) => [location.name, location]));
  const positions = new Map<string, number>();

  for (const row of rows) {
    const brandCode = locationBrandCode(row.locationName);
    if (brandCode !== PLACEHOLDER_BRAND_CODE) {
      const brand = brands.get(brandCode);
      if (!brand || brand.is_active !== 1) {
        throw new Error(`Brand ${brandCode} tidak ditemukan atau nonaktif.`);
      }
    }
    const location = locations.get(row.locationName);
    if (!location) throw new Error(`Lokasi pada baris ${row.sourceRowNumber} tidak ditemukan.`);

    const key = positionKey(row.positionName, row.locationName);
    if (!positions.has(key)) {
      let divisionName: string;
      let title: string;
      if (key.startsWith("\u0000")) {
        title = key.slice(1);
        const [matches] = await connection.execute<PositionRow[]>(
          "SELECT id, division_id, name, is_active FROM positions WHERE name=?",
          [title],
        );
        if (matches.length !== 1) {
          throw new Error(`Jabatan ${title} tidak dapat dipetakan secara unik.`);
        }
        if (matches[0].is_active !== 1 && commit) {
          await connection.execute("UPDATE positions SET is_active=TRUE WHERE id=?", [matches[0].id]);
        }
        divisionName = "";
        positions.set(key, matches[0].id);
        continue;
      }
      [divisionName, title] = key.split("\u0000");
      const divisionId = divisions.get(divisionName);
      if (!divisionId) throw new Error(`Divisi ${divisionName} tidak ditemukan.`);
      positions.set(key, await ensurePosition(connection, title, divisionId, commit));
    }
  }

  return { placeholderBrandId, brands, locations, positions, divisions };
}

function mapBrandId(
  row: SourceRow,
  organization: Awaited<ReturnType<typeof loadOrganization>>,
): number {
  const code = locationBrandCode(row.locationName);
  return code === PLACEHOLDER_BRAND_CODE
    ? organization.placeholderBrandId
    : organization.brands.get(code)!.id;
}

function mapPositionId(
  row: SourceRow,
  organization: Awaited<ReturnType<typeof loadOrganization>>,
): number {
  return organization.positions.get(positionKey(row.positionName, row.locationName))!;
}

function countNiks(rows: SourceRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.nik) continue;
    const hash = createBlindIndex(row.nik);
    counts.set(hash, (counts.get(hash) ?? 0) + 1);
  }
  return counts;
}

function employeeInput(
  row: SourceRow,
  brandId: number,
  positionId: number,
  locationId: number,
  safeNik: string | null,
): EmployeeRecordInput {
  return {
    fullName: row.fullName,
    nik: safeNik,
    birthPlace: row.birthPlace,
    birthDate: row.birthDate,
    addressCurrent: row.addressCurrent,
    addressKtp: row.addressKtp,
    email: row.email,
    phone: row.phone,
    npwp: row.npwp,
    bankName: null,
    bankAccountNumber: row.bankAccountNumber,
    companyId: null,
    brandId,
    positionId,
    locationId,
    joinDate: row.joinDate,
    maritalStatus: row.maritalStatus,
    childrenCount: row.childrenCount,
  };
}

async function updateExistingEmployee(
  connection: Connection,
  employeeId: number,
  data: EmployeeRecordInput,
): Promise<void> {
  await connection.execute(
    `UPDATE employees
     SET full_name=?,
         nik_encrypted=COALESCE(?, nik_encrypted),
         nik_hash=COALESCE(?, nik_hash),
         birth_place=COALESCE(?, birth_place),
         birth_date=COALESCE(?, birth_date),
         address_current=COALESCE(?, address_current),
         address_ktp=COALESCE(?, address_ktp),
         email=COALESCE(?, email),
         phone=COALESCE(?, phone),
         npwp_encrypted=COALESCE(?, npwp_encrypted),
         bank_account_encrypted=COALESCE(?, bank_account_encrypted),
         marital_status=COALESCE(?, marital_status),
         children_count=COALESCE(?, children_count),
         company_id=NULL, brand_id=?, position_id=?, location_id=?,
         join_date=COALESCE(?, join_date),
         is_active=TRUE, exit_date=NULL, exit_reason_id=NULL
     WHERE id=?`,
    [
      data.fullName,
      data.nik ? encryptField(data.nik) : null,
      data.nik ? createBlindIndex(data.nik) : null,
      data.birthPlace,
      data.birthDate,
      data.addressCurrent,
      data.addressKtp,
      data.email,
      data.phone,
      data.npwp ? encryptField(data.npwp) : null,
      data.bankAccountNumber ? encryptField(data.bankAccountNumber) : null,
      data.maritalStatus,
      data.childrenCount,
      data.brandId,
      data.positionId,
      data.locationId,
      data.joinDate,
      employeeId,
    ],
  );
}

async function run(filePath: string, commit: boolean): Promise<void> {
  const env = getDbEnv();
  if (!isLocalHost(env.DB_HOST)) {
    throw new Error("Refusing to process employee personal data unless DB_HOST is localhost.");
  }
  const workbook = await readWorkbook(filePath);
  const connection = await createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: "utf8mb4",
  });

  try {
    if (commit) await connection.beginTransaction();
    const { stagingByRow, previousSourceHash } = await loadAndValidateStaging(
      connection,
      workbook.rows,
    );
    const organization = await loadOrganization(connection, workbook.rows, commit);
    const [existingNikRows] = await connection.query<EmployeeNikRow[]>(
      "SELECT id, nik_hash FROM employees WHERE nik_hash IS NOT NULL",
    );
    const existingNiks = new Map(
      existingNikRows.map((employee) => [employee.nik_hash!, employee.id]),
    );
    const nikCounts = countNiks(workbook.rows);
    const brandCounts = new Map<string, number>();
    const positionCounts = new Map<string, number>();
    let rowsToInsert = 0;
    let rowsToUpdate = 0;
    let birthDatesMapped = 0;
    let joinDatesMapped = 0;
    let nikImported = 0;
    let nikSkipped = 0;
    let sensitiveNumericSkipped = 0;
    let stagingPayloadsChanged = 0;
    const planned: Array<{
      row: SourceRow;
      staging: StagingRow;
      data: EmployeeRecordInput;
      brandLabel: string;
      safeNik: string | null;
    }> = [];

    for (const row of workbook.rows) {
      const staged = stagingByRow.get(row.sourceRowNumber)!;
      const brandCode = locationBrandCode(row.locationName);
      const brandLabel = brandCode === PLACEHOLDER_BRAND_CODE
        ? PLACEHOLDER_BRAND_NAME
        : organization.brands.get(brandCode)!.name;
      const location = organization.locations.get(row.locationName)!;
      const safeNikCandidate = row.nik ? createBlindIndex(row.nik) : null;
      const safeNik = safeNikCandidate &&
        nikCounts.get(safeNikCandidate) === 1 &&
        (!existingNiks.has(safeNikCandidate) || existingNiks.get(safeNikCandidate) === staged.employee_id)
        ? row.nik
        : null;

      if (safeNik) nikImported++;
      else if (row.nik) nikSkipped++;
      if (
        row.numericFields.has(HEADERS.npwp) ||
        row.numericFields.has(HEADERS.bankAccount) ||
        row.numericFields.has(HEADERS.phone)
      ) {
        sensitiveNumericSkipped++;
      }
      if (row.birthDate) birthDatesMapped++;
      if (row.joinDate) joinDatesMapped++;
      if (staged.status === "PENDING") rowsToInsert++;
      else rowsToUpdate++;
      brandCounts.set(brandLabel, (brandCounts.get(brandLabel) ?? 0) + 1);
      const positionName = row.positionName === "Admin"
        ? positionKey(row.positionName, row.locationName).split("\u0000")[1]
        : row.positionName;
      positionCounts.set(positionName, (positionCounts.get(positionName) ?? 0) + 1);

      const oldPayload = JSON.parse(decryptField(staged.payload_encrypted)) as Record<string, unknown>;
      const sourceFieldsChanged = Object.entries(row.payload).some(([header, value]) => {
        const previousValue = oldPayload[header];
        const normalize = (item: unknown): string | null => {
          if (item === null || item === undefined || String(item).trim() === "") return null;
          return String(item).trim();
        };
        return normalize(previousValue) !== normalize(value);
      });
      if (sourceFieldsChanged) {
        stagingPayloadsChanged++;
      }
      const data = employeeInput(
        row,
        mapBrandId(row, organization),
        mapPositionId(row, organization),
        location.id,
        safeNik,
      );
      planned.push({ row, staging: staged, data, brandLabel, safeNik });
    }

    const summary = {
      mode: commit ? "commit" : "dry-run",
      sourceRows: workbook.rows.length,
      rowsToInsert,
      existingEmployeesToUpdate: rowsToUpdate,
      targetActiveEmployees: rowsToInsert + rowsToUpdate,
      brandOnlyEmployees: workbook.rows.length,
      sourceWorkbookHashMatchesStaging: previousSourceHash === workbook.sourceHash,
      stagingRowsWithChangedSourceFields: stagingPayloadsChanged,
      brandCounts: Object.fromEntries([...brandCounts].sort(([a], [b]) => a.localeCompare(b))),
      positionCounts: Object.fromEntries([...positionCounts].sort(([a], [b]) => a.localeCompare(b))),
      birthDatesMapped,
      joinDatesMapped,
      safeUniqueNiksImported: nikImported,
      NIKsLeftBlankForSafety: nikSkipped,
      numericContactIdentifiersLeftBlank: sensitiveNumericSkipped,
    };

    if (!commit) {
      console.info(JSON.stringify(summary, null, 2));
      return;
    }

    for (const row of workbook.rows) {
      const location = organization.locations.get(row.locationName)!;
      if (location.is_active !== 1) {
        await connection.execute("UPDATE locations SET is_active=TRUE WHERE id=?", [location.id]);
      }
    }
    for (const item of planned) {
      let employeeId = item.staging.employee_id;
      if (item.staging.status === "PROMOTED") {
        if (employeeId === null) throw new Error("Promoted staging row has no employee.");
        const [employeeRows] = await connection.execute<EmployeeNameRow[]>(
          "SELECT id, full_name FROM employees WHERE id=? FOR UPDATE",
          [employeeId],
        );
        if (!employeeRows[0] || employeeRows[0].full_name !== item.row.fullName) {
          throw new Error(`Karyawan linked pada baris ${item.row.sourceRowNumber} tidak cocok.`);
        }
        await updateExistingEmployee(connection, employeeId, item.data);
      } else {
        const inserted = await insertEmployeeRecord(
          connection,
          item.data,
          null,
          { createOnboardingChecklist: false },
        );
        employeeId = inserted.employeeId;
      }

      const staged = item.staging;
      const [updated] = await connection.execute<ResultSetHeader>(
        `UPDATE employee_import_staging
         SET source_sha256=?, payload_encrypted=?, status='PROMOTED', employee_id=?
         WHERE id=? AND status IN ('PENDING','PROMOTED')`,
        [
          workbook.sourceHash,
          encryptField(JSON.stringify(item.row.payload)),
          employeeId,
          staged.id,
        ],
      );
      if (updated.affectedRows !== 1) {
        throw new Error(`Gagal memperbarui staging baris ${item.row.sourceRowNumber}.`);
      }
    }

    await connection.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (NULL, 'employee.active_import', 'employee_import', ?, ?)`,
      [
        null,
        JSON.stringify({
          sourceRows: workbook.rows.length,
          previousSourceSha256: previousSourceHash,
          sourceSha256: workbook.sourceHash,
          rowsInserted: rowsToInsert,
          existingEmployeesUpdated: rowsToUpdate,
          brandCounts: Object.fromEntries(brandCounts),
          stagingRowsWithChangedSourceFields: stagingPayloadsChanged,
          birthDatesMapped,
          joinDatesMapped,
          safeUniqueNiksImported: nikImported,
          NIKsLeftBlankForSafety: nikSkipped,
          numericContactIdentifiersLeftBlank: sensitiveNumericSkipped,
        }),
      ],
    );
    await connection.commit();
    console.info(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (commit) await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

const args = parseArgs(process.argv.slice(2));
void run(args.filePath, args.commit).catch((error: unknown) => {
  console.error("[employee-active-import] Failed.", {
    reason: error instanceof Error ? error.message : "Unknown error",
    code: typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined,
  });
  process.exitCode = 1;
});
