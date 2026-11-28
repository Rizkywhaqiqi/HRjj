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
    label: "Administrasi HR",
    items: [
      {
        label: "Data Karyawan",
        href: "/employees",
        icon: "users",
        permission: PERMISSIONS.employeeView,
        featureKey: "employees",
      },
      {
        label: "Kontrak & Pengingat",
        href: "/contracts",
        icon: "briefcase",
        permission: PERMISSIONS.contractView,
        featureKey: "contracts",
      },
      {
        label: "Surat & Riwayat",
        href: "/letters",
        icon: "history",
        permission: PERMISSIONS.letterView,
        featureKey: "letters",
      },
    ],
  },
  {
    label: "Keuangan",
    items: [
      {
        label: "Data Gaji Karyawan",
        href: "/finance",
        icon: "users",
        permission: PERMISSIONS.financeView,
        featureKey: "employees",
      },
      {
        label: "Pengajuan Perubahan Gaji",
        href: "/finance/requests",
        icon: "briefcase",
        permission: PERMISSIONS.financeView,
        featureKey: "employees",
      },
      {
        label: "Riwayat Perubahan Gaji",
        href: "/finance/history",
        icon: "history",
        permission: PERMISSIONS.financeView,
        featureKey: "employees",
      },
    ],
  },
  {
    label: "Laporan",
    items: [
      {
        label: "Laporan Karyawan",
        href: "/reports",
        icon: "history",
        permission: PERMISSIONS.reportView,
        featureKey: "reports",
      },
    ],
  },
  {
    label: "Master Data",
    items: [
      {
        label: "Semua Referensi",
        href: "/master-data",
        icon: "building",
        permission: PERMISSIONS.masterDataView,
      },
      {
        label: "Brand & CV",
        href: "/master-data?section=organisation",
        icon: "building",
        permission: PERMISSIONS.masterDataView,
      },
      {
        label: "Jabatan & Divisi",
        href: "/master-data?section=positions",
        icon: "briefcase",
        permission: PERMISSIONS.masterDataView,
      },
      {
        label: "Outlet",
        href: "/master-data?section=locations",
        icon: "building",
        permission: PERMISSIONS.masterDataView,
      },
      {
        label: "Kontrak & Alasan Keluar",
        href: "/master-data?section=references",
        icon: "history",
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
        label: "Modul Aplikasi",
        href: "/settings/feature-flags",
        icon: "toggle",
        permission: PERMISSIONS.featureFlagManage,
      },
      {
        label: "Riwayat Aktivitas",
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
    description:
      "Generator surat SP, SKK, kontrak, NDA, dan surat masih bekerja.",
  },
  {
    key: "reports",
    label: "Laporan HR",
    description: "Rekap dan ekspor laporan HR.",
  },
];

/** Filters navigation with the permissions loaded into the session. */
export async function visibleNavSections(
  permissions: readonly string[],
): Promise<NavSection[]> {
  const sections = await Promise.all(
    NAV_SECTIONS.map(async (section) => {
      const items = await Promise.all(
        section.items.map(async (item) => {
          if (!permissions.includes(item.permission)) return null;
          if (item.featureKey && !(await isFeatureEnabled(item.featureKey)))
            return null;
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
