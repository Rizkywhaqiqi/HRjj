/**
 * Canonical permission codes. Keep in sync with `database/seed.ts`; permissions
 * are always read from the database, these constants only prevent typos.
 */
export const PERMISSIONS = {
  dashboardView: "dashboard.view",
  employeeView: "employee.view",
  employeeCreate: "employee.create",
  employeeUpdate: "employee.update",
  employeeDeactivate: "employee.deactivate",
  employeeViewSensitive: "employee.view_sensitive",
  employeeViewPrivateFields: "employee.view_private_fields",
  employeeExport: "employee.export",
  contractView: "contract.view",
  contractCreate: "contract.create",
  contractUpdate: "contract.update",
  contractDecide: "contract.decide",
  contractExport: "contract.export",
  letterView: "letter.view",
  letterCreate: "letter.create",
  reportView: "report.view",
  reportExport: "report.export",
  masterDataView: "master_data.view",
  masterDataManage: "master_data.manage",
  userView: "user.view",
  userManage: "user.manage",
  roleView: "role.view",
  roleManage: "role.manage",
  featureFlagManage: "feature_flag.manage",
  auditView: "audit.view",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
