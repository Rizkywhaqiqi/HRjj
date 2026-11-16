const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_EXCEL_SERIAL = 2_958_465;

function formatDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fromExcelSerial(serial: number, date1904: boolean): string | null {
  if (
    !Number.isFinite(serial) ||
    serial < (date1904 ? 0 : 1) ||
    serial > MAX_EXCEL_SERIAL
  ) {
    return null;
  }

  const wholeDays = Math.floor(serial);
  if (!date1904 && wholeDays === 60) return null;

  const adjustedDays =
    !date1904 && wholeDays < 60 ? wholeDays + 1 : wholeDays;
  const epoch = date1904
    ? Date.UTC(1904, 0, 1)
    : Date.UTC(1899, 11, 30);
  const date = new Date(epoch + adjustedDays * MILLISECONDS_PER_DAY);

  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}

function fromDateText(value: string, date1904: boolean): string | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) return formatDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (compact) return formatDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));

  const localized = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (localized) {
    return formatDate(Number(localized[3]), Number(localized[2]), Number(localized[1]));
  }

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return fromExcelSerial(Number(text), date1904);
  }

  return null;
}

export function parseExcelDate(
  value: unknown,
  date1904 = false,
): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") return fromExcelSerial(value, date1904);
  if (typeof value === "string") return fromDateText(value, date1904);

  return null;
}
