"use client";

import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { buttonPrimary } from "@/components/ui/primitives";

export default function LetterDocumentPreview({ letterId }: { letterId: number }) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const container = documentRef.current;
    if (!container) return;

    let active = true;
    container.replaceChildren();
    setStatus("loading");

    async function loadDocument() {
      try {
        const response = await fetch(`/api/files/letters/${letterId}/preview`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Surat tidak dapat dimuat.");

        const document = await response.arrayBuffer();
        const renderTarget = documentRef.current;
        if (!active || !renderTarget) return;

        await renderAsync(document, renderTarget, renderTarget, {
          className: "docx",
          inWrapper: true,
          hideWrapperOnPrint: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          useBase64URL: true,
          renderAltChunks: false,
          renderComments: false,
          renderChanges: false,
        });
        if (active) setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadDocument();
    return () => {
      active = false;
      container.replaceChildren();
    };
  }, [letterId]);

  return (
    <div>
      <div className="letter-preview-toolbar mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Gunakan tombol ini lalu pilih <b>Simpan sebagai PDF</b> di dialog cetak browser.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={status !== "ready"}
          className={buttonPrimary}
        >
          Cetak / Simpan PDF
        </button>
      </div>
      {status === "loading" ? (
        <p className="letter-preview-toolbar rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Memuat preview surat…
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="letter-preview-toolbar rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          Preview surat gagal dimuat. Pastikan file surat tersedia dan Anda memiliki akses.
        </p>
      ) : null}
      <div
        ref={documentRef}
        className="letter-preview-document overflow-x-auto rounded-xl bg-slate-100 p-3 sm:p-6 print:overflow-visible print:bg-white print:p-0"
        aria-label="Preview isi surat"
      />
    </div>
  );
}
