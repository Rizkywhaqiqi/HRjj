import { redirect } from "next/navigation";

/** Compatibility route for old bookmarks such as /master-data/locations. */
export default async function LegacyMasterDataSectionPage() {
  redirect("/master-data");
}
