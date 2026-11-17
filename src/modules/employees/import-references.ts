import {
  listBrandOptions,
  listCompanyOptions,
  listPositionOptions,
  listLocations,
} from "@/modules/master-data";
import type { SessionUser } from "@/types/database";
export async function importReferences(user: SessionUser) {
  const [brands, companies, positions, locations] = await Promise.all([
    listBrandOptions(user),
    listCompanyOptions(user),
    listPositionOptions(),
    listLocations(user),
  ]);
  return {
    brands,
    companies,
    positions,
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      parentId: l.brand_id,
    })),
  };
}
