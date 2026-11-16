import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { getLetterPreviewInfo } from "@/modules/letters";
import { Badge, buttonSecondary, PageHeader } from "@/components/ui/primitives";
import LetterDocumentPreview from "./letter-document-preview";

export const instant = false;

function statusTone(status: string): "neutral" | "warning" | "info" | "success" {
  if (status === "PENDING_APPROVAL") return "warning";
  if (status === "APPROVED") return "info";
  if (status === "ISSUED") return "success";
  return "neutral";
}

function statusLabel(status: string): string {
  if (status === "ISSUED") return "Tersimpan";
  if (status === "DRAFT") return "Draf";
  if (status === "PENDING_APPROVAL") return "Menunggu persetujuan";
  if (status === "APPROVED") return "Disetujui";
  return status;
}

function letterTypeLabel(type: string): string {
  return type === "CONTRACT" ? "Penawaran kerja" : type;
}

export default async function LetterPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission(PERMISSIONS.letterView);
  await requireFeatureEnabled("letters");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const letter = await getLetterPreviewInfo(actor, id);
  if (!letter) notFound();

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Preview surat"
          description={`${letter.letter_number} · ${letterTypeLabel(letter.type)} · ${letter.full_name}`}
          action={
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(letter.status)}>{statusLabel(letter.status)}</Badge>
              <Link href="/letters" className={buttonSecondary}>Kembali ke daftar</Link>
            </div>
          }
        />
      </div>
      <LetterDocumentPreview letterId={letter.id} />
    </div>
  );
}
