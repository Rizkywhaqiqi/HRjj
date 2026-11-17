export const AUDIT_ACTIONS = {
  loginSuccess: "auth.login.success",
  loginFailed: "auth.login.failed",
  logout: "auth.logout",
  passwordChange: "auth.password.change",
  userCreate: "user.create",
  userUpdate: "user.update",
  userActivate: "user.activate",
  userDeactivate: "user.deactivate",
  userPasswordReset: "user.password.reset",
  userSessionsRevoked: "user.sessions.revoke",
  roleCreate: "role.create",
  roleUpdate: "role.update",
  roleDelete: "role.delete",
  rolePermissionsUpdate: "role.permissions.update",
  featureFlagUpdate: "feature_flag.update",
  masterDataCreate: "master_data.create",
  masterDataUpdate: "master_data.update",
  masterDataDeactivate: "master_data.deactivate",
  masterDataDelete: "master_data.delete",
  sensitiveRead: "security.sensitive_read",
  exportData: "security.export",
  employeeCreate: "employee.create",
  employeeUpdate: "employee.update",
  employeeImport: "employee.import",
  employeeImportFailed: "employee.import.failed",
  letterCreate: "letter.create",
  contractCreate: "contract.create",
  contractDecision: "contract.decision",
  employeeDeactivate: "employee.deactivate",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// Only security events and meaningful data operations belong in activity history.
export const RECORDED_AUDIT_ACTIONS: readonly string[] = Object.values(AUDIT_ACTIONS);
const recordedActions = new Set(RECORDED_AUDIT_ACTIONS);

export function shouldRecordAuditAction(action: string): boolean {
  return recordedActions.has(action);
}
