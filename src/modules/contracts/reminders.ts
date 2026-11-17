export function contractReminder(days: number | null): {
  label: string;
  tone: "danger" | "warning" | "neutral";
} {
  if (days === null) return { label: "Tanpa tanggal akhir", tone: "neutral" };
  if (days < 0)
    return { label: `Lewat ${Math.abs(days)} hari`, tone: "danger" };
  if (days === 0) return { label: "Berakhir hari ini", tone: "danger" };
  if (days <= 7)
    return { label: `H-${days} · segera tindak lanjuti`, tone: "danger" };
  if (days <= 30)
    return { label: `H-${days} · siapkan keputusan`, tone: "warning" };
  return { label: `${days} hari lagi`, tone: "neutral" };
}
