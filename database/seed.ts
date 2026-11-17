import "dotenv/config";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { closePool, withTransaction } from "../src/core/db";

const initialAdminSchema = z.object({
  SUPER_ADMIN_EMAIL: z.string().trim().email(),
  SUPER_ADMIN_PASSWORD: z.string().min(16),
});

const brands = [
  { code: "JOJO", name: "Jojo" },
  { code: "JLY", name: "JLY" },
  { code: "GUULAK", name: "Guulak" },
  { code: "ANA", name: "Ana" },
  { code: "MUTIARA", name: "Mutiara" },
] as const;

const companies = [
  { brand: "JOJO", name: "CV Jojo Natura Sentosa" },
  { brand: "JOJO", name: "CV Muhi Rasa Sentosa" },
  { brand: "JLY", name: "CV Rasa Manis Nusantara" },
  { brand: "GUULAK", name: "CV Hanara Boga Kuliner" },
  { brand: "ANA", name: "CV Ana Bakery Indonesia" },
  { brand: "MUTIARA", name: "CV Mutiara Anugerah Prima" },
] as const;

const positionsByDivision = {
  Operasional: [
    "Manager Operasional",
    "Manager Area",
    "Supervisor",
    "Staff Outlet",
    "Staff Middle",
    "Baker",
    "Barista",
    "Kasir",
  ],
  Gudang: ["Kepala Gudang", "Admin Gudang", "Staff Gudang", "Driver"],
  "Dapur Produksi": ["Admin Dapur", "Staff Dapur"],
  "Head Office": [
    "Head Finance",
    "Admin Jojo",
    "Admin JLY",
    "Admin Guulak",
    "Admin Ana",
    "Head Accounting",
    "Admin Pajak",
    "Head Purchasing",
    "Admin Purchasing",
    "Admin CS",
    "Admin Stock",
    "Admin Finance",
    "Head HRD",
    "Admin HRD",
    "Legal Officer",
    "Arsitek",
    "IT Support",
    "Admin Proyek",
    "Trainer Barista",
    "Maintenance",
  ],
  Marketing: [
    "Head Marketing",
    "Marketing Brand",
    "Desain Grafis",
    "Content Creator",
    "Social Media Specialist",
    "Videografer/Fotografer",
  ],
} as const;

const exitReasons = [
  {
    name: "Resign baik-baik (serah terima selesai)",
    severity: "GREEN",
    rehirable: true,
  },
  {
    name: "Kontrak selesai & layak diperpanjang",
    severity: "GREEN",
    rehirable: true,
  },
  { name: "Pensiun", severity: "GREEN", rehirable: true },
  {
    name: "PHK Efisiensi / Penutupan Cabang",
    severity: "GREEN",
    rehirable: true,
  },
  { name: "Kontrak tidak diperpanjang", severity: "YELLOW", rehirable: true },
  { name: "Resign tanpa pemberitahuan", severity: "YELLOW", rehirable: true },
  { name: "Tidak lulus masa percobaan", severity: "YELLOW", rehirable: true },
  { name: "Diberhentikan tidak hormat", severity: "RED", rehirable: false },
  { name: "PHK karena pelanggaran / SP3", severity: "RED", rehirable: false },
  { name: "Mangkir berkepanjangan", severity: "RED", rehirable: false },
] as const;

const contractTypes = [
  { name: "PKWT 2 Bulan", months: 2, reminderDays: 14, permanent: false },
  { name: "PKWT 3 Bulan", months: 3, reminderDays: 14, permanent: false },
  { name: "PKWT 6 Bulan", months: 6, reminderDays: 14, permanent: false },
  { name: "PKWT 1 Tahun", months: 12, reminderDays: 14, permanent: false },
  { name: "Magang", months: null, reminderDays: 14, permanent: false },
  { name: "PKWTT/Tetap", months: null, reminderDays: 0, permanent: true },
] as const;

const leaveTypes = [
  ["Cuti Tahunan", 12],
  ["Cuti Sakit", 0],
  ["Cuti Melahirkan", 90],
  ["Izin Khusus", 0],
] as const;

const permissions = [
  ["dashboard.view", "dashboard", "Melihat dashboard"],
  ["employee.view", "employees", "Melihat data karyawan"],
  ["employee.create", "employees", "Menambah data karyawan"],
  ["employee.update", "employees", "Mengubah data karyawan"],
  ["employee.deactivate", "employees", "Menonaktifkan karyawan"],
  [
    "employee.view_sensitive",
    "employees",
    "Melihat NIK, NPWP, rekening, dan KTP",
  ],
  [
    "employee.view_private_fields",
    "employees",
    "Melihat data pribadi karyawan",
  ],
  ["employee.export", "employees", "Mengekspor data karyawan"],
  ["contract.view", "contracts", "Melihat kontrak"],
  ["contract.create", "contracts", "Membuat kontrak"],
  ["contract.update", "contracts", "Mengubah kontrak"],
  [
    "contract.decide",
    "contracts",
    "Memutuskan perpanjangan atau akhir kontrak",
  ],
  ["contract.export", "contracts", "Mengekspor data kontrak"],
  ["letter.view", "letters", "Melihat surat"],
  ["letter.create", "letters", "Membuat surat"],
  ["report.view", "reports", "Melihat laporan"],
  ["report.export", "reports", "Mengekspor laporan"],
  ["master_data.view", "master-data", "Melihat data master"],
  ["master_data.manage", "master-data", "Mengelola data master"],
  ["user.view", "users", "Melihat pengguna"],
  ["user.manage", "users", "Mengelola pengguna"],
  ["role.view", "roles", "Melihat peran dan izin"],
  ["role.manage", "roles", "Mengelola peran dan izin"],
  ["feature_flag.manage", "settings", "Mengelola saklar fitur"],
  ["audit.view", "audit", "Melihat audit log"],
] as const;

const allPermissionCodes = permissions.map(([code]) => code);
const employeeManagerPermissions = [
  "dashboard.view",
  "employee.view",
  "employee.create",
  "employee.update",
  "employee.deactivate",
  "employee.view_sensitive",
  "employee.view_private_fields",
  "employee.export",
  "contract.view",
  "contract.create",
  "contract.update",
  "contract.decide",
  "contract.export",
  "letter.view",
  "letter.create",
  "report.view",
  "report.export",
  "master_data.view",
  "master_data.manage",
  "audit.view",
];

const systemRoles = [
  {
    name: "Super Admin",
    description: "Akses penuh ke seluruh modul dan brand.",
    permissions: allPermissionCodes,
  },
  {
    name: "Head HRD",
    description: "Pengelolaan HR lintas brand dan persetujuan.",
    permissions: [...employeeManagerPermissions, "user.view", "role.view"],
  },
  {
    name: "Admin HRD",
    description: "Operasional data karyawan, kontrak, dan surat.",
    permissions: [
      ...employeeManagerPermissions.filter(
        (code) => code !== "master_data.manage",
      ),
    ],
  },
  {
    name: "Admin Brand",
    description: "Operasional HR terbatas pada brand yang diberikan.",
    permissions: [
      "dashboard.view",
      "employee.view",
      "employee.create",
      "employee.update",
      "employee.deactivate",
      "contract.view",
      "letter.view",
      "report.view",
    ],
  },
  {
    name: "Viewer",
    description: "Akses baca laporan dan informasi HR yang tidak sensitif.",
    permissions: [
      "dashboard.view",
      "employee.view",
      "contract.view",
      "letter.view",
      "report.view",
    ],
  },
] as const;

const featureFlags = [
  ["employees", "Modul Karyawan"],
  ["contracts", "Modul Kontrak"],
  ["letters", "Modul Surat"],
  ["reports", "Laporan HR"],
] as const;

async function seedMasterData(): Promise<void> {
  const adminResult = initialAdminSchema.safeParse({
    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD,
  });

  if (!adminResult.success) {
    const invalidKeys = adminResult.error.issues.map((issue) =>
      issue.path.join("."),
    );
    throw new Error(
      `Set valid SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (at least 16 characters) before seeding. Invalid: ${invalidKeys.join(", ")}`,
    );
  }

  const adminEmail = adminResult.data.SUPER_ADMIN_EMAIL.toLowerCase();
  const adminPasswordHash = await bcrypt.hash(
    adminResult.data.SUPER_ADMIN_PASSWORD,
    12,
  );
  await withTransaction(async (connection) => {
    for (const brand of brands) {
      await connection.execute(
        `INSERT INTO brands (code, name)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = TRUE`,
        [brand.code, brand.name],
      );
    }

    const [brandRows] = await connection.execute<
      Array<RowDataPacket & { id: number; code: string }>
    >("SELECT id, code FROM brands");
    const brandIds = new Map(brandRows.map((brand) => [brand.code, brand.id]));

    for (const company of companies) {
      const brandId = brandIds.get(company.brand);
      if (brandId === undefined) {
        throw new Error(`Missing seeded brand: ${company.brand}`);
      }

      await connection.execute(
        `INSERT INTO companies (brand_id, name)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE brand_id = VALUES(brand_id), is_active = TRUE`,
        [brandId, company.name],
      );
    }

    const divisionIds = new Map<string, number>();
    for (const divisionName of Object.keys(positionsByDivision)) {
      await connection.execute(
        `INSERT INTO divisions (name)
         VALUES (?)
         ON DUPLICATE KEY UPDATE is_active = TRUE`,
        [divisionName],
      );
      const [rows] = await connection.execute<
        Array<RowDataPacket & { id: number }>
      >("SELECT id FROM divisions WHERE name = ?", [divisionName]);
      const division = rows[0];
      if (!division) {
        throw new Error(`Failed to load seeded division: ${divisionName}`);
      }
      divisionIds.set(divisionName, division.id);
    }

    for (const [divisionName, positionNames] of Object.entries(
      positionsByDivision,
    )) {
      const divisionId = divisionIds.get(divisionName);
      if (divisionId === undefined) {
        throw new Error(`Missing seeded division: ${divisionName}`);
      }
      for (const positionName of positionNames) {
        await connection.execute(
          `INSERT INTO positions (division_id, name)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE is_active = TRUE`,
          [divisionId, positionName],
        );
      }
    }

    for (const reason of exitReasons) {
      await connection.execute(
        `INSERT INTO exit_reasons (name, severity, rehirable)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           severity = VALUES(severity),
           rehirable = VALUES(rehirable),
           is_active = TRUE`,
        [reason.name, reason.severity, reason.rehirable],
      );
    }

    for (const contractType of contractTypes) {
      await connection.execute(
        `INSERT INTO contract_types (name, default_months, reminder_days, is_permanent)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           default_months = VALUES(default_months),
           reminder_days = VALUES(reminder_days),
           is_permanent = VALUES(is_permanent),
           is_active = TRUE`,
        [
          contractType.name,
          contractType.months,
          contractType.reminderDays,
          contractType.permanent,
        ],
      );
    }

    for (const [name, annualDays] of leaveTypes) {
      await connection.execute(
        `INSERT INTO leave_types (name, annual_days) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE annual_days = VALUES(annual_days), is_active = TRUE`,
        [name, annualDays],
      );
    }

    for (const [code, module, description] of permissions) {
      await connection.execute(
        `INSERT INTO permissions (code, module, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           module = VALUES(module),
           description = VALUES(description)`,
        [code, module, description],
      );
    }

    const roleIds = new Map<string, number>();
    for (const role of systemRoles) {
      await connection.execute(
        `INSERT INTO roles (name, description, is_system)
         VALUES (?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           description = VALUES(description),
           is_system = TRUE`,
        [role.name, role.description],
      );

      const [rows] = await connection.execute<
        Array<RowDataPacket & { id: number }>
      >("SELECT id FROM roles WHERE name = ?", [role.name]);
      const row = rows[0];
      if (!row) {
        throw new Error(`Failed to load seeded role: ${role.name}`);
      }
      roleIds.set(role.name, row.id);

      const [permissionCountRows] = await connection.execute<
        Array<RowDataPacket & { permission_count: number }>
      >(
        "SELECT COUNT(*) AS permission_count FROM role_permissions WHERE role_id = ?",
        [row.id],
      );

      if (role.name === "Super Admin") {
        await connection.execute(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id)
           SELECT ?, id FROM permissions`,
          [row.id],
        );
      } else if (permissionCountRows[0]?.permission_count === 0) {
        for (const permissionCode of role.permissions) {
          await connection.execute(
            `INSERT INTO role_permissions (role_id, permission_id)
             SELECT ?, id FROM permissions WHERE code = ?`,
            [row.id, permissionCode],
          );
        }
      }
    }

    for (const [featureKey, label] of featureFlags) {
      await connection.execute(
        `INSERT INTO feature_flags (feature_key, label)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE label = VALUES(label)`,
        [featureKey, label],
      );
    }

    const superAdminRoleId = roleIds.get("Super Admin");
    if (superAdminRoleId === undefined) {
      throw new Error("Super Admin role was not seeded.");
    }

    const [existingAdminRows] = await connection.execute<
      Array<
        RowDataPacket & {
          id: number;
          role_id: number;
          is_active: number;
          scope_all: number;
        }
      >
    >("SELECT id, role_id, is_active, scope_all FROM users WHERE email = ?", [
      adminEmail,
    ]);

    if (existingAdminRows.length === 0) {
      await connection.execute(
        `INSERT INTO users (role_id, name, email, password_hash, scope_all, is_active)
         VALUES (?, ?, ?, ?, TRUE, TRUE)`,
        [superAdminRoleId, "JOJO Super Admin", adminEmail, adminPasswordHash],
      );
    } else {
      const existingAdmin = existingAdminRows[0];
      if (
        existingAdmin.role_id !== superAdminRoleId ||
        existingAdmin.is_active !== 1 ||
        existingAdmin.scope_all !== 1
      ) {
        throw new Error(
          "The configured Super Admin email already belongs to an inactive, scoped, or non-Super Admin account. Resolve this account manually.",
        );
      }
    }
  });

  console.info("Master data and default role permissions seeded.");
  console.info("Initial Super Admin account is ready.");
  await closePool();
}

void seedMasterData().catch(async (error: unknown) => {
  console.error("Database seed failed.", error);
  try {
    await closePool();
  } catch (closeError) {
    console.error("Failed to close the database pool.", closeError);
  }
  process.exitCode = 1;
});
