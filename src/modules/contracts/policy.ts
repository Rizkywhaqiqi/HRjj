import { nextContractDate } from "./date";

export function validateContractPeriod(
  start: string,
  end: string | null,
  permanent: boolean,
  previousEnd?: string | null,
): void {
  if (end && end < start)
    throw new Error("Tanggal akhir tidak boleh sebelum tanggal mulai.");
  if (permanent && end)
    throw new Error("Kontrak tetap tidak boleh memiliki tanggal akhir.");
  if (!permanent && !end)
    throw new Error("Kontrak berjangka wajib memiliki tanggal akhir.");
  if (
    previousEnd !== undefined &&
    (!previousEnd || start !== nextContractDate(previousEnd))
  )
    throw new Error(
      "Kontrak berikutnya harus dimulai sehari setelah kontrak lama berakhir.",
    );
}

// A decision must not terminate employment before the inclusive last working day.
export function contractExitDate(end: string | null, today: string): string {
  if (!end || today <= end)
    throw new Error(
      "Kontrak belum berakhir. Keputusan keluar dapat disimpan setelah hari terakhir kontrak.",
    );
  return end;
}
