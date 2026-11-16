import { PERMISSIONS, type PermissionCode } from "./rbac/permissions";
import { isFeatureEnabled } from "./rbac/guard";

export type NavIconName =
  | "dashboard"
  | "briefcase"
  | "building"
  | "users"
  | "shield"
  | "toggle"
  | "history";

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: NavIconName;
  readonly permission: PermissionCode;
  readonly featureKey?: string;
}

export interface NavSection {
  readonly label: string;
  readonly standalone?: boolean;
  readonly items: readonly NavItem[];
}

/**
 * Single source for navigation, permissions, and feature gating. Only modules
 * that are actually implemented are listed here.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: "Dashboard",
    standalone: true,
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "dashboard",
        permission: PERMISSIONS.dashboardView,
      },
    ],
  },
  {
    label: "Utama",
    items: [
      {
        label: "Karyawan",
        href: "/employees",
        icon: "users",
        permission: PERMISSIONS.employeeView,
        featureKey: "employees",
      },
      {
        label: "Tambah karyawan",
        href: "/employees/new",
        icon: "users",
        permission: PERMISSIONS.employeeCreate,
        featureKey: "employees",
      },
      {
        label: "Checklist",
        href: "/checklists",
        icon: "toggle",
        permission: PERMISSIONS.checklistView,
        featureKey: "checklists",
      },
      {
        label: "Cuti & Izin",
        href: "/leave",
        icon: "toggle",
        permission: PERMISSIONS.leaveView,
      },
      {
        label: "Payroll & BPJS",
        href: "/payroll",
        icon: "history",
        permission: PERMISSIONS.payrollView,
      },
      {
        label: "Inventaris",
        href: "/assets",
        icon: "building",
        permission: PERMISSIONS.assetView,
      },
      {
        label: "Laporan",
        href: "/reports",
        icon: "history",
        permission: PERMISSIONS.reportView,
        featureKey: "reports",
      },
    ],
  },
  {
    label: "Dokumen HR",
    items: [
      {
        label: "Arsip Surat",
        href: "/letters",
        icon: "history",
        permission: PERMISSIONS.letterView,
        featureKey: "letters",
      },
      {
        label: "Surat Peringatan",
        href: "/warnings",
        icon: "history",
        permission: PERMISSIONS.employeeView,
        featureKey: "employees",
      },
    ],
  },
  {
    label: "Recruitment",
    items: [
      {
        label: "Kandidat",
        href: "/recruitment",
        icon: "users",
        permission: PERMISSIONS.recruitmentView,
        featureKey: "recruitment",
      },
      {
        label: "Lowongan Karir",
        href: "/recruitment/vacancies",
        icon: "briefcase",
        permission: PERMISSIONS.vacancyManage,
        featureKey: "recruitment",
      },
    ],
  },
  {
    label: "Organisasi",
    items: [
      {
        label: "Master Data",
        href: "/master-data",
        icon: "building",
        permission: PERMISSIONS.masterDataView,
      },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      {
        label: "Pengguna",
        href: "/settings/users",
        icon: "users",
        permission: PERMISSIONS.userView,
      },
      {
        label: "Peran & Izin",
        href: "/settings/roles",
        icon: "shield",
        permission: PERMISSIONS.roleView,
      },
      {
        label: "Saklar Fitur",
        href: "/settings/feature-flags",
        icon: "toggle",
        permission: PERMISSIONS.featureFlagManage,
      },
      {
        label: "Audit Log",
        href: "/settings/audit-logs",
        icon: "history",
        permission: PERMISSIONS.auditView,
      },
    ],
  },
];

export interface FeatureFlagDefinition {
  key: string;
  label: string;
  description: string;
}

export const FEATURE_FLAGS: readonly FeatureFlagDefinition[] = [
  {
    key: "employees",
    label: "Modul Karyawan",
    description: "Menu dan data karyawan internal.",
  },
  {
    key: "contracts",
    label: "Modul Kontrak",
    description: "Kontrak kerja, perpanjangan, dan pengingat.",
  },
  {
    key: "letters",
    label: "Modul Surat",
    description: "Generator surat SP, SKK, kontrak, NDA, dan surat masih bekerja.",
  },
  {
    key: "reports",
    label: "Laporan HR",
    description: "Rekap dan ekspor laporan HR.",
  },
  {
    key: "recruitment",
    label: "Recruitment",
    description: "Lowongan, kandidat, dan proses seleksi.",
  },
  {
    key: "checklists",
    label: "Checklist Onboarding dan Offboarding",
    description: "Checklist operasional saat karyawan masuk atau keluar.",
  },
];

/** Filters navigation with the permissions loaded into the session. */
export async function visibleNavSections(permissions: readonly string[]): Promise<NavSection[]> {
  const sections = await Promise.all(
    NAV_SECTIONS.map(async (section) => {
      const items = await Promise.all(
        section.items.map(async (item) => {
          if (!permissions.includes(item.permission)) return null;
          if (item.featureKey && !(await isFeatureEnabled(item.featureKey))) return null;
          return item;
        }),
      );
      return {
        label: section.label,
        standalone: section.standalone,
        items: items.filter((item): item is NavItem => item !== null),
      };
    }),
  );
  return sections.filter((section) => section.items.length > 0);
}
