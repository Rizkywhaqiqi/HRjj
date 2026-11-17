import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { getLetter } from "@/modules/letters";
import { parseSnapshot } from "@/modules/letters/templates";
import {
  PageHeader,
  Card,
  CardBody,
  buttonSecondary,
} from "@/components/ui/primitives";
export const instant = false;
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePermission(PERMISSIONS.letterView);
  await requireFeatureEnabled("letters");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const letter = await getLetter(actor, id);
  if (!letter) notFound();
  const snapshot = parseSnapshot(letter.metadata);
  return (
    <div className="space-y-5">
      <PageHeader
        title={snapshot?.title ?? "Arsip surat lama"}
        description={letter.letter_number}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/letters" className={buttonSecondary}>
              Kembali ke riwayat
            </Link>
            <a href={`/api/files/letters/${id}`} className={buttonSecondary}>
              {snapshot ? "Unduh PDF" : "Unduh dokumen lama"}
            </a>
          </div>
        }
      />
      {snapshot ? (
        <>
          <p className="text-sm text-slate-500">
            Snapshot template v{snapshot.version}. Unduh ulang tidak mengubah
            nomor atau isi surat.
          </p>
          <iframe
            title={`Preview ${letter.letter_number}`}
            src={`/api/files/letters/${id}/preview`}
            className="h-[78vh] min-h-96 w-full rounded-2xl border border-slate-200 bg-white"
          />
        </>
      ) : (
        <Card>
          <CardBody>
            Surat ini dibuat sebelum sistem snapshot. Dokumen asli tetap
            tersedia melalui tombol unduh jika arsipnya ada. Riwayat lama tidak
            dibangun ulang dari data karyawan terbaru.
          </CardBody>
        </Card>
      )}
    </div>
  );
}
