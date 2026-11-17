import type { PermissionRow } from "@/types/database";
import type { RoleSummary } from "@/modules/roles";
import {
  createRoleAction,
  deleteRoleAction,
  updateRolePermissionsAction,
  updateRoleAction,
} from "@/modules/roles/actions";
import { SubmitButton } from "@/components/ui/form";
import {
  Field,
  buttonDanger,
  inputClass,
  labelClass,
} from "@/components/ui/primitives";

interface PermissionGroup {
  module: string;
  items: PermissionRow[];
}

export function groupPermissions(
  permissions: PermissionRow[],
): PermissionGroup[] {
  const groups = new Map<string, PermissionRow[]>();

  for (const permission of permissions) {
    const list = groups.get(permission.module) ?? [];
    list.push(permission);
    groups.set(permission.module, list);
  }

  return [...groups.entries()].map(([module, items]) => ({ module, items }));
}

export function moduleLabel(module: string): string {
  const labels: Record<string, string> = {
    audit: "Audit Log",
    contracts: "Kontrak",
    dashboard: "Dashboard",
    employees: "Karyawan",
    letters: "Surat HR",
    "master-data": "Master Data",
    reports: "Laporan",
    roles: "Peran & Izin",
    settings: "Pengaturan",
    users: "Pengguna",
  };

  return labels[module] ?? module.replace(/-/g, " ");
}

function PermissionCheckboxes({
  permissions,
  selected,
  disabled = false,
}: {
  permissions: PermissionRow[];
  selected: number[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {groupPermissions(permissions).map((group) => (
        <fieldset key={group.module}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {moduleLabel(group.module)} · {group.items.length} izin
          </legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {group.items.map((permission) => (
              <label
                key={permission.id}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  name="permissionIds"
                  value={permission.id}
                  defaultChecked={selected.includes(permission.id)}
                  disabled={disabled}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span>
                  <span className="font-medium">{permission.code}</span>
                  <span className="block text-xs text-slate-500">
                    {permission.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function RoleCreateForm({
  permissions,
}: {
  permissions: PermissionRow[];
}) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-brand-700">
        + Tambah peran kustom
      </summary>
      <form
        action={createRoleAction}
        className="space-y-4 border-t border-slate-100 px-5 py-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama peran" htmlFor="role-name">
            <input
              id="role-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              className={inputClass}
            />
          </Field>
          <Field label="Deskripsi" htmlFor="role-description">
            <input
              id="role-description"
              name="description"
              maxLength={255}
              className={inputClass}
            />
          </Field>
        </div>

        <div>
          <p className={labelClass}>Izin awal</p>
          <div className="mt-2 rounded-xl border border-slate-200 p-3">
            <PermissionCheckboxes permissions={permissions} selected={[]} />
          </div>
        </div>

        <SubmitButton>Simpan peran</SubmitButton>
      </form>
    </details>
  );
}

export function RoleManageForm({
  role,
  permissions,
  selectedPermissionIds,
}: {
  role: RoleSummary;
  permissions: PermissionRow[];
  selectedPermissionIds: number[];
}) {
  const permissionsLocked = role.name === "Super Admin";

  return (
    <details className="rounded-xl border border-slate-200">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-700">
        Kelola peran
      </summary>
      <div className="space-y-5 border-t border-slate-100 px-4 py-4">
        <form action={updateRoleAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="roleId" value={role.id} />
          <Field label="Nama peran" htmlFor={`role-name-${role.id}`}>
            <input
              id={`role-name-${role.id}`}
              name="name"
              defaultValue={role.name}
              required
              maxLength={80}
              className={inputClass}
            />
          </Field>
          <Field label="Deskripsi" htmlFor={`role-description-${role.id}`}>
            <input
              id={`role-description-${role.id}`}
              name="description"
              defaultValue={role.description ?? ""}
              maxLength={255}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Simpan nama & deskripsi</SubmitButton>
          </div>
        </form>

        <form action={updateRolePermissionsAction} className="space-y-3">
          <input type="hidden" name="roleId" value={role.id} />
          <div>
            <p className={labelClass}>Modul & izin peran</p>
            <p className="mt-1 text-xs text-slate-500">
              Centang izin yang diperlukan, lalu simpan dengan tombol di bagian
              bawah daftar.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <PermissionCheckboxes
              key={selectedPermissionIds.join(",")}
              permissions={permissions}
              selected={selectedPermissionIds}
              disabled={permissionsLocked}
            />
          </div>
          {permissionsLocked ? (
            <p className="text-xs text-slate-500">
              Izin Super Admin dikunci dan tidak dapat diubah.
            </p>
          ) : (
            <SubmitButton>Simpan modul & izin</SubmitButton>
          )}
        </form>

        {!role.isSystem ? (
          <form action={deleteRoleAction}>
            <input type="hidden" name="roleId" value={role.id} />
            <button type="submit" className={buttonDanger}>
              Hapus peran
            </button>
          </form>
        ) : null}
      </div>
    </details>
  );
}
