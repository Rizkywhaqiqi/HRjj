import { hasPermission, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { listRoleOptions, listUsers } from "@/modules/users";
import { listBrands } from "@/modules/master-data";
import { Pagination, parsePage } from "@/components/shared/pagination";
import { FlashAlerts, readFlash } from "@/components/shared/flash";
import { firstParam, formatDateTime } from "@/components/shared/format";
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  buttonSecondary,
  inputClass,
} from "@/components/ui/primitives";
import {
  UserCreateForm,
  UserEditForm,
  UserFrozenNotice,
  UserSecurityForms,
} from "./user-forms";

export const instant = false;

const PAGE_SIZE = 10;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.userView);
  const canManage = hasPermission(actor, PERMISSIONS.userManage);

  const params = await searchParams;
  const search = firstParam(params.search) ?? "";
  const page = parsePage(params.page);

  const [result, roles, brands] = await Promise.all([
    listUsers({ search, page, pageSize: PAGE_SIZE }),
    listRoleOptions(),
    listBrands(),
  ]);
  const flash = readFlash(params);

  return (
    <div>
      <PageHeader
        title="Pengguna internal"
        description="Kelola akses staf, peran, cakupan brand, dan sesi login."
      />

      <FlashAlerts {...flash} />

      <div className="mb-4">
        {canManage ? (
          <UserCreateForm roles={roles} brands={brands} />
        ) : (
          <UserFrozenNotice />
        )}
      </div>

      <Card>
        <CardBody>
          <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Cari nama atau email"
              className={inputClass}
            />
            <button type="submit" className={buttonSecondary}>
              Cari
            </button>
          </form>

          {result.users.length === 0 ? (
            <EmptyState
              title="Belum ada pengguna yang cocok"
              description="Ubah kata kunci pencarian atau tambahkan pengguna baru."
            />
          ) : (
            <ul className="space-y-3">
              {result.users.map((user) => {
                const names = result.brandNames.get(user.id) ?? [];
                const ids = result.brandIds.get(user.id) ?? [];

                return (
                  <li
                    key={user.id}
                    className="rounded-xl border border-slate-200"
                  >
                    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {user.name}
                          {user.id === actor.id ? (
                            <span className="ml-2 text-xs font-medium text-brand-700">
                              (Anda)
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {user.email}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="info">{user.role_name}</Badge>
                        <Badge tone={user.is_active === 1 ? "success" : "neutral"}>
                          {user.is_active === 1 ? "Aktif" : "Nonaktif"}
                        </Badge>
                        <Badge tone="brand">
                          {user.scope_all === 1
                            ? "Semua brand"
                            : `${names.length} brand`}
                        </Badge>
                      </div>
                    </div>

                    <p className="px-4 pb-3 text-xs leading-5 text-slate-500">
                      {user.scope_all === 1
                        ? "Akses seluruh brand"
                        : names.length > 0
                          ? names.join(", ")
                          : "Tanpa akses brand"}
                      {" · Login terakhir: "}
                      {formatDateTime(user.last_login_at)}
                    </p>

                    {canManage ? (
                      <details className="border-t border-slate-100 px-4 py-3">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-700">
                          Kelola pengguna ini
                        </summary>
                        <div className="mt-4 space-y-5">
                          <UserEditForm
                            user={user}
                            roles={roles}
                            brands={brands}
                            brandIds={ids}
                          />
                          <UserSecurityForms
                            user={user}
                            isSelf={user.id === actor.id}
                          />
                        </div>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={result.total}
            basePath="/settings/users"
            query={{ search: search || undefined }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
