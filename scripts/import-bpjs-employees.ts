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
} from "../src/core/crypto/field-encrypt";
import { getDbEnv } from "../src/core/env";
import { normalizePhone } from "../src/core/normalization";
import { parseExcelDate } from "../src/modules/employees/import-date";
import {
  insertEmployeeRecord,
  type EmployeeRecordInput,
} from "../src/modules/employees/insert-employee";

const MAX_ROWS = 1000;
const PLACEHOLDER_BRAND_CODE = "UNASSIGNED";
const PLACEHOLDER_BRAND_NAME = "Belum Ditentukan";

const HEADERS = {
  name: "Nama Lengkap Karyawan?",
  status: "Status",
  birth: "Tempat, Tanggal Lahir",
  bloodType: "Golongan Darah",
  motherName: "Nama Ibu",
  location: "Penempatan Kerja?",
  position: "Posisi?",
  joinDate: "Tanggal Mulai Bergabung di Perusahaan?",
  religion: "Agama?",
  addressCurrent: "Alamat Tinggal Saat ini?",
  addressKtp: "Alamat Sesuai KTP?",
  email: "Email?",
  phone: "Nomor Handphone",
  npwp: "NPWP",
  bankAccount: "Nomor Rekening?",
  children: "Jika sudah menikah, sudah mempunyai berapa anak?",
  nik: "NIK",
} as const;

interface SourceRow {
  sourceRowNumber: number;
  fullName: string;
  locationName: string;
  positionName: string;
  birthPlace: string | null;
  birthDate: string | null;
  joinDate: string | null;
  nik: string | null;
  maritalStatus: EmployeeRecordInput["maritalStatus"];
  bloodType: string | null;
  motherName: string | null;
  religion: string | null;
  addressCurrent: string | null;
  addressKtp: string | null;
  email: string | null;
  phone: string | null;
  npwp: string | null;
  bankAccountNumber: string | null;
  childrenCount: number | null;
}

interface BrandRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  is_active: 0 | 1;
}

interface CompanyRow extends RowDataPacket {
  id: number;
  brand_id: number;
  name: string;
  is_active: 0 | 1;
}

interface LocationRow extends RowDataPacket {
  id: number;
  name: string;
  is_active: 0 | 1;
}

interface PositionRow extends RowDataPacket {
  id: number;
  name: string;
  is_active: 0 | 1;
}

function isLocalHost(host: string): boolean {
  return ["localhost", "127.0.0.1", "::1"].includes(host.trim().toLowerCase());
}

function cellText(cell: ExcelJS.Cell): string | null {
  const text = cell.text;
  return text === "" ? null : text;
}

function parseBirthDate(
  value: string | null,
  date1904: boolean,
): { place: string | null; date: string | null } {
  if (!value) return { place: null, date: null };
  const comma = value.lastIndexOf(",");
  if (comma < 1) return { place: null, date: null };

  const place = value.slice(0, comma).trim();
  const dateText = value.slice(comma + 1).trim();
  let date = parseExcelDate(dateText, date1904);
  if (!date) {
    const namedMonth = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i.exec(dateText);
    if (namedMonth) {
      const month = MONTHS[namedMonth[2].toLowerCase()];
      if (month) {
        date = parseExcelDate(
          `${namedMonth[3]}-${String(month).padStart(2, "0")}-${String(Number(namedMonth[1])).padStart(2, "0")}`,
          date1904,
        );
      }
    }
  }

  return date && place.length >= 2 && place.length <= 100
    ? { place, date }
    : { place: null, date: null };
}

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

function parseMaritalStatus(value: string | null): SourceRow["maritalStatus"] {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "belum menikah") return "SINGLE";
  if (normalized === "menikah") return "MARRIED";
  if (normalized === "cerai" || normalized === "bercerai") return "DIVORCED";
  return null;
}

function parseChildren(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /(\d+)/.exec(trimmed);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isInteger(count) && count >= 0 && count <= 30 ? count : null;
}

function safeText(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function validEmail(value: string | null): string | null {
  if (!value || value.length > 150) return null;
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function validPhone(value: string | null): string | null {
  if (!value) return null;
  const normalized = normalizePhone(value);
  return /^\+?\d{8,30}$/.test(normalized) ? normalized : null;
}

function parseBankAccount(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === "-" || trimmed === "tidak ada") return null;
  const withoutBankName = trimmed.replace(/^(bri|bca|mandiri|bni|cimb|danamon|permata|panin|ocbc|maybank)\s+/i, "");
  const digits = withoutBankName.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
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
  if (!prefix) return PLACEHOLDER_BRAND_CODE;
  return prefix.toUpperCase();
}

async function readWorkbook(
  filePath: string,
): Promise<{ sourceHash: string; rows: SourceRow[] }> {
  const bytes = await readFile(filePath);
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
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
    if (!columns.has(header)) {
      throw new Error(`Header "${header}" tidak ditemukan dalam file Excel.`);
    }
  }

  const rows: SourceRow[] = [];
  sheet.eachRow((row, sourceRowNumber) => {
    if (sourceRowNumber === 1) return;

    const payload: Record<string, string | null> = {};
    for (const [header, columnNumber] of columns) {
      payload[header] = cellText(row.getCell(columnNumber));
    }

    const fullName = cellText(row.getCell(columns.get(HEADERS.name)!))?.trim() || null;
    if (!fullName) return;
    if (fullName.length > 150) {
      throw new Error(`Nama pada baris ${sourceRowNumber} melebihi 150 karakter.`);
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

    const birth = parseBirthDate(get(HEADERS.birth), workbook.properties.date1904 ?? false);
    const nikText = get(HEADERS.nik);
    const nik = nikText && /^\d{16}$/.test(nikText) ? nikText : null;

    rows.push({
      sourceRowNumber,
      fullName,
      locationName,
      positionName,
      birthPlace: birth.place,
      birthDate: birth.date,
      joinDate: parseExcelDate(
        row.getCell(columns.get(HEADERS.joinDate)!).value,
        workbook.properties.date1904 ?? false,
      ),
      nik,
      maritalStatus: parseMaritalStatus(get(HEADERS.status)),
      bloodType: safeText(get(HEADERS.bloodType), 5),
      motherName: safeText(get(HEADERS.motherName), 150),
      religion: safeText(get(HEADERS.religion), 30),
      addressCurrent: safeText(get(HEADERS.addressCurrent), 2000),
      addressKtp: safeText(get(HEADERS.addressKtp), 2000),
      email: validEmail(get(HEADERS.email)),
      phone: validPhone(get(HEADERS.phone)),
      npwp: safeText(get(HEADERS.npwp), 50),
      bankAccountNumber: parseBankAccount(get(HEADERS.bankAccount)),
      childrenCount: parseChildren(get(HEADERS.children)),
    });
  });

  if (rows.length === 0 || rows.length > MAX_ROWS) {
    throw new Error(`Jumlah baris bernama harus antara 1 dan ${MAX_ROWS}.`);
  }

  return { sourceHash, rows };
}

function positionKey(positionName: string, locationName: string): string {
  if (positionName === "Admin") {
    const division =
      locationName === "Dapur Meranti" ? "Dapur Produksi" :
      locationName === "Gudang" ? "Gudang" :
      locationName === "Operasional Management" ? "Operasional" :
      locationName === "Office" ? "Head Office" :
      locationName.startsWith("JOJO") ? "Operasional" :
      locationName.startsWith("Guulak") ? "Operasional" :
      locationName.startsWith("JLY") ? "Operasional" :
      locationName.startsWith("Ana") ? "Operasional" :
      null;
    const title =
      locationName === "Dapur Meranti" ? "Admin Dapur" :
      locationName === "Gudang" ? "Admin Gudang" :
      locationName === "Office" ? "Admin Jojo" :
      locationName.startsWith("JOJO") ? "Admin Jojo" :
      locationName.startsWith("Guulak") ? "Admin Guulak" :
      locationName.startsWith("JLY") ? "Admin JLY" :
      locationName.startsWith("Ana") ? "Admin Ana" :
      "Admin";
    if (!division) throw new Error(`Pemetaan jabatan Admin untuk lokasi "${locationName}" tidak dikenal.`);
    return `${division}\u0000${title}`;
  }
  if (positionName === "Marketing") return `Marketing\u0000Marketing Brand`;
  if (positionName === "Manager Area / Assistant Manager") {
    return `Operasional\u0000Manager Area`;
  }
  return `\u0000${positionName}`;
}

async function ensurePlaceholderBrandAndCompany(
  connection: Connection,
  commit: boolean,
): Promise<{ brandId: number; companyId: number | null }> {
  const [brandRows] = await connection.query<BrandRow[]>(
    "SELECT id, code, name, is_active FROM brands WHERE code=? OR name=?",
    [PLACEHOLDER_BRAND_CODE, PLACEHOLDER_BRAND_NAME],
  );
  let brandId: number;
  if (brandRows.length > 0) {
    const b = brandRows[0];
    if (b.code !== PLACEHOLDER_BRAND_CODE || b.name !== PLACEHOLDER_BRAND_NAME) {
      throw new Error("Kode atau nama brand placeholder sudah dipakai.");
    }
    brandId = b.id;
    if (b.is_active !== 1 && commit) {
      await connection.execute("UPDATE brands SET is_active=TRUE WHERE id=?", [brandId]);
    }
  } else {
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO brands (code, name, description) VALUES (?, ?, ?)",
      [PLACEHOLDER_BRAND_CODE, PLACEHOLDER_BRAND_NAME, "Brand sementara untuk lokasi tanpa pemetaan brand tertentu."],
    );
    brandId = result.insertId;
  }

  const [companyRows] = await connection.query<CompanyRow[]>(
    "SELECT id, brand_id, name, is_active FROM companies WHERE brand_id=? LIMIT 1",
    [brandId],
  );
  let companyId: number | null = null;
  if (companyRows.length > 0) {
    companyId = companyRows[0].id;
    if (companyRows[0].is_active !== 1 && commit) {
      await connection.execute("UPDATE companies SET is_active=TRUE WHERE id=?", [companyId]);
    }
  } else {
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO companies (brand_id, name, is_active) VALUES (?, ?, TRUE)",
      [brandId, PLACEHOLDER_BRAND_NAME],
    );
    companyId = result.insertId;
  }

  return { brandId, companyId };
}

async function loadOrganization(
  connection: Connection,
  rows: SourceRow[],
  commit: boolean,
): Promise<{
  brands: Map<string, BrandRow>;
  companies: Map<number, CompanyRow[]>;
  locations: Map<string, LocationRow>;
  positions: Map<string, number>;
  missingPositionKeys: Set<string>;
  placeholderBrandId: number;
  placeholderCompanyId: number | null;
}> {
  const [brandRows] = await connection.query<BrandRow[]>(
    "SELECT id, code, name, is_active FROM brands",
  );
  const brands = new Map(brandRows.map((b) => [b.code.toUpperCase(), b]));

  const [companyRows] = await connection.query<CompanyRow[]>(
    "SELECT id, brand_id, name, is_active FROM companies",
  );
  const companies = new Map<number, CompanyRow[]>();
  for (const c of companyRows) {
    const list = companies.get(c.brand_id) ?? [];
    list.push(c);
    companies.set(c.brand_id, list);
  }

  const [locationRows] = await connection.query<LocationRow[]>(
    "SELECT id, name, is_active FROM locations",
  );
  const locations = new Map(locationRows.map((l) => [l.name, l]));

  const [divisionRows] = await connection.query<Array<RowDataPacket & { id: number; name: string }>>(
    "SELECT id, name FROM divisions",
  );
  const divisions = new Map(divisionRows.map((d) => [d.name, d.id]));

  const positions = new Map<string, number>();
  const missingPositionKeys = new Set<string>();
  for (const row of rows) {
    const key = positionKey(row.positionName, row.locationName);
    if (positions.has(key) || missingPositionKeys.has(key)) continue;

    let divisionName: string;
    let title: string;
    if (key.startsWith("\u0000")) {
      title = key.slice(1);
      divisionName = "";
    } else {
      [divisionName, title] = key.split("\u0000");
    }

    let positionId: number | null = null;
    if (divisionName === "") {
      const [matches] = await connection.query<PositionRow[]>(
        "SELECT id, is_active FROM positions WHERE name=? LIMIT 1",
        [title],
      );
      if (matches.length === 1) positionId = matches[0].id;
    } else {
      const divisionId = divisions.get(divisionName);
      if (divisionId) {
        const [matches] = await connection.query<PositionRow[]>(
          "SELECT id, is_active FROM positions WHERE division_id=? AND name=? LIMIT 1",
          [divisionId, title],
        );
        if (matches.length === 1) positionId = matches[0].id;
      }
    }

    if (positionId === null) {
      missingPositionKeys.add(key);
    } else {
      positions.set(key, positionId);
    }
  }

  const { brandId: placeholderBrandId, companyId: placeholderCompanyId } =
    await ensurePlaceholderBrandAndCompany(connection, commit);

  return {
    brands,
    companies,
    locations,
    positions,
    missingPositionKeys,
    placeholderBrandId,
    placeholderCompanyId,
  };
}

function mapBrandId(
  row: SourceRow,
  organizations: {
    brands: Map<string, BrandRow>;
    companies: Map<number, CompanyRow[]>;
    locations: Map<string, LocationRow>;
    positions: Map<string, number>;
    placeholderBrandId: number;
    placeholderCompanyId: number | null;
  },
): { brandId: number; companyId: number | null } {
  const code = locationBrandCode(row.locationName);
  if (code === PLACEHOLDER_BRAND_CODE) {
    return {
      brandId: organizations.placeholderBrandId,
      companyId: organizations.placeholderCompanyId,
    };
  }
  const brand = organizations.brands.get(code);
  if (!brand) {
    throw new Error(
      `Brand untuk lokasi "${row.locationName}" (kode ${code}) tidak ditemukan.`,
    );
  }
  const companyList = organizations.companies.get(brand.id) ?? [];
  const activeCompany = companyList.find((c) => c.is_active === 1);
  const companyId = activeCompany ? activeCompany.id : null;
  return { brandId: brand.id, companyId };
}

function employeeInput(
  row: SourceRow,
  brandId: number,
  companyId: number | null,
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
    companyId,
    brandId,
    positionId,
    locationId,
    joinDate: row.joinDate,
    maritalStatus: row.maritalStatus,
    childrenCount: row.childrenCount,
  };
}

async function run(filePath: string, commit: boolean): Promise<void> {
  const env = getDbEnv();
  if (!isLocalHost(env.DB_HOST)) {
    throw new Error("Menolak pemrosesan data pribadi karyawan kecuali DB_HOST adalah localhost.");
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

    const orgs = await loadOrganization(connection, workbook.rows, commit);

    // Check existing NIKs for uniqueness
    const [existingNikRows] = await connection.query<Array<RowDataPacket & { id: number; nik_hash: string | null }>>(
      "SELECT id, nik_hash FROM employees WHERE nik_hash IS NOT NULL",
    );
    const existingNikHashes = new Set(
      existingNikRows.map((e) => e.nik_hash).filter((h): h is string => !!h),
    );

    // Count NIK occurrences within this file
    const nikCounts = new Map<string, number>();
    for (const row of workbook.rows) {
      if (!row.nik) continue;
      const hash = createBlindIndex(row.nik);
      nikCounts.set(hash, (nikCounts.get(hash) ?? 0) + 1);
    }

    let inserted = 0;
    let skippedNik = 0;
    let skippedMissingPosition = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (const row of workbook.rows) {
      try {
        const location = orgs.locations.get(row.locationName);
        if (!location) {
          errors.push({ row: row.sourceRowNumber, message: `Lokasi "${row.locationName}" tidak ditemukan.` });
          continue;
        }
        if (location.is_active !== 1 && commit) {
          await connection.execute("UPDATE locations SET is_active=TRUE WHERE id=?", [location.id]);
        }

        const posKey = positionKey(row.positionName, row.locationName);
        if (orgs.missingPositionKeys.has(posKey)) {
          skippedMissingPosition++;
          errors.push({ row: row.sourceRowNumber, message: `Jabatan "${row.positionName}" tidak tersedia di database.` });
          continue;
        }
        const positionId = orgs.positions.get(posKey);
        if (!positionId) {
          errors.push({ row: row.sourceRowNumber, message: `Jabatan "${row.positionName}" tidak ditemukan.` });
          continue;
        }

        const { brandId, companyId } = mapBrandId(row, orgs);

        // Validate NIK uniqueness
        let safeNik: string | null = null;
        if (row.nik) {
          const nikHash = createBlindIndex(row.nik);
          const isDuplicateInFile = (nikCounts.get(nikHash) ?? 0) > 1;
          const existsInDb = existingNikHashes.has(nikHash);
          if (!isDuplicateInFile && !existsInDb) {
            safeNik = row.nik;
          } else {
            skippedNik++;
          }
        }

        const data = employeeInput(row, brandId, companyId, positionId, location.id, safeNik);

        await insertEmployeeRecord(connection, data, null, {
          createOnboardingChecklist: false,
        });
        inserted++;
      } catch (error) {
        errors.push({
          row: row.sourceRowNumber,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    if (commit) {
      await connection.commit();
    } else {
      await connection.rollback();
    }

    console.info(
      JSON.stringify(
        {
          totalRows: workbook.rows.length,
          inserted,
          skippedNikDuplicate: skippedNik,
          skippedMissingPosition: skippedMissingPosition,
          errors: errors.length,
          errorDetails: errors,
          dryRun: !commit,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (commit) await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const filePath = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
const commit = args.includes("--commit");

async function main() {
  if (!filePath || filePath.startsWith("--")) {
    console.error('Usage: npx tsx scripts/import-bpjs-employees.ts --file <path-to-xlsx> [--commit]');
    console.error("");
    console.error("Contoh (dry-run, tidak menyimpan ke DB):");
    console.error("  npx tsx scripts/import-bpjs-employees.ts --file 'c:/Users/othkodylinz_/Downloads/KELENGKAPAN DATA BPJS (Jawaban).xlsx'");
    console.error("");
    console.error("Contoh (commit, simpan ke DB):");
    console.error("  npx tsx scripts/import-bpjs-employees.ts --file 'c:/Users/othkodylinz_/Downloads/KELENGKAPAN DATA BPJS (Jawaban).xlsx' --commit");
    process.exitCode = 1;
    return;
  }

  await run(path.resolve(filePath), commit);
}

void main().catch((error) => {
  console.error("[import-bpjs-employees] Gagal:", {
    reason: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});

