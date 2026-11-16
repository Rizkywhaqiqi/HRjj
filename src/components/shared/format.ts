export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
