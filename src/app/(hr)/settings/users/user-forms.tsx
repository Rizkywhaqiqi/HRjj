import type { BrandRow, UserListRow } from "@/types/database";
import type { RoleOption } from "@/modules/users";
import {
  createUserAction,
  resetUserPasswordAction,
  revokeUserSessionsAction,
  updateUserAction,
} from "@/modules/users/actions";
import { SubmitButton } from "@/components/ui/form";
import { Field, inputClass, labelClass } from "@/components/ui/primitives";

function ScopeCheckbox({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
      <input
        type="checkbox"
        name="scopeAll"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span>
        <span className="font-medium">Akses semua brand</span>
        <span className="block text-xs text-slate-500">
          Jika tidak dicentang, pilih minimal satu brand di bawah.
        </span>
      </span>
    </label>
  );
}

function BrandCheckboxes({
  brands,
  selected,
}: {
  brands: BrandRow[];
  selected: number[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className={labelClass}>Akses brand</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <label
            key={brand.id}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              name="brandIds"
              value={brand.id}
              defaultChecked={selected.includes(brand.id)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="truncate">
              {brand.name}
              {brand.is_active === 0 ? " (nonaktif)" : ""}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RoleSelect({
  id,
  roles,
  defaultValue,
}: {
  id: string;
  roles: RoleOption[];
  defaultValue?: number;
}) {
  return (
    <select
      id={id}
      name="roleId"
      required
      defaultValue={defaultValue ? String(defaultValue) : ""}
      className={inputClass}
    >
      <option value="" disabled>
        Pilih peran
      </option>
      {roles.map((role) => (
        <option key={role.id} value={role.id}>
          {role.name}
        </option>
      ))}
    </select>
  );
}

export function UserCreateForm({
  roles,
  brands,
}: {
  roles: RoleOption[];
  brands: BrandRow[];
}) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-brand-700">
        + Tambah pengguna internal
      </summary>
      <form
        action={createUserAction}
        className="space-y-4 border-t border-slate-100 px-5 py-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap" htmlFor="new-name">
            <input
              id="new-name"
              name="name"
              required
              minLength={2}
              maxLength={120}
              className={inputClass}
            />
          </Field>
          <Field label="Email" htmlFor="new-email">
            <input
              id="new-email"
              name="email"
              type="email"
              required
              maxLength={150}
              className={inputClass}
            />
          </Field>
          <Field
            label="Password awal"
            htmlFor="new-password"
            hint="Minimal 12 karakter. Sampaikan ke pengguna lewat kanal aman."
          >
            <input
              id="new-password"
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={72}
              className={inputClass}
            />
          </Field>
          <Field label="Peran" htmlFor="new-role">
            <RoleSelect id="new-role" roles={roles} />
          </Field>
        </div>

        <ScopeCheckbox defaultChecked={false} />
        <BrandCheckboxes brands={brands} selected={[]} />

        <SubmitButton>Simpan pengguna</SubmitButton>
      </form>
    </details>
  );
}

export function UserEditForm({
  user,
  roles,
  brands,
  brandIds,
}: {
  user: UserListRow;
  roles: RoleOption[];
  brands: BrandRow[];
  brandIds: number[];
}) {
  return (
    <form action={updateUserAction} className="space-y-4">
      <input type="hidden" name="userId" value={user.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama lengkap" htmlFor={`name-${user.id}`}>
          <input
            id={`name-${user.id}`}
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={user.name}
            className={inputClass}
          />
        </Field>
        <Field label="Email" htmlFor={`email-${user.id}`}>
          <input
            id={`email-${user.id}`}
            name="email"
            type="email"
            required
            maxLength={150}
            defaultValue={user.email}
            className={inputClass}
          />
        </Field>
        <Field label="Peran" htmlFor={`role-${user.id}`}>
          <RoleSelect
            id={`role-${user.id}`}
            roles={roles}
            defaultValue={user.role_id}
          />
        </Field>
        <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={user.is_active === 1}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Akun aktif
        </label>
      </div>

      <ScopeCheckbox defaultChecked={user.scope_all === 1} />
      <BrandCheckboxes brands={brands} selected={brandIds} />

      <SubmitButton>Simpan perubahan</SubmitButton>
    </form>
  );
}

export function UserSecurityForms({
  user,
  isSelf,
}: {
  user: UserListRow;
  isSelf: boolean;
}) {
  return (
    <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
      <form action={resetUserPasswordAction} className="space-y-2">
        <input type="hidden" name="userId" value={user.id} />
        <Field
          label="Reset password"
          htmlFor={`reset-${user.id}`}
          hint="Semua sesi pengguna ini akan dicabut."
        >
          <input
            id={`reset-${user.id}`}
            name="newPassword"
            type="password"
            required
            minLength={12}
            maxLength={72}
            placeholder="Password baru (min. 12 karakter)"
            className={inputClass}
          />
        </Field>
        <SubmitButton variant="secondary" pendingLabel="Mereset...">
          Reset password
        </SubmitButton>
      </form>

      <form
        action={revokeUserSessionsAction}
        className="flex flex-col justify-end"
      >
        <input type="hidden" name="userId" value={user.id} />
        <p className="mb-2 text-xs leading-5 text-slate-500">
          Mencabut seluruh sesi aktif tanpa mengubah password.
          {isSelf ? " Anda akan keluar dari sesi ini." : ""}
        </p>
        <div>
          <SubmitButton variant="danger" pendingLabel="Mencabut...">
            Cabut semua sesi
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function UserFrozenNotice() {
  return (
    <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
      Anda hanya memiliki akses baca. Perubahan pengguna membutuhkan izin
      <span className="font-semibold"> user.manage</span>.
    </p>
  );
}
