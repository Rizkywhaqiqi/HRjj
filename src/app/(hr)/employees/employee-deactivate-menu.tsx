"use client";

import { useCallback, useRef, useState } from "react";
import { AnchoredPopover } from "@/components/ui/anchored-popover";
import { buttonDanger, inputClass } from "@/components/ui/primitives";

interface EmployeeDeactivateMenuProps {
  employeeId: number;
  employeeName: string;
  exitReasons: { id: number; name: string }[];
  deactivateAction: (formData: FormData) => Promise<void>;
}

export default function EmployeeDeactivateMenu({
  employeeId,
  employeeName,
  exitReasons,
  deactivateAction,
}: EmployeeDeactivateMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="rounded-lg px-2 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
      >
        Nonaktifkan
      </button>
      <AnchoredPopover
        open={open}
        onClose={close}
        anchorRef={triggerRef}
        align="end"
        width={288}
        className="p-3"
        ariaLabel={`Nonaktifkan ${employeeName}`}
      >
        <form action={deactivateAction} className="grid gap-2 text-left">
          <input type="hidden" name="employeeId" value={employeeId} />
          <p className="text-xs font-semibold text-slate-700">
            Nonaktifkan {employeeName}?
          </p>
          <label className="grid gap-1 text-xs text-slate-600">
            Tanggal keluar
            <input name="exitDate" type="date" required className={inputClass} />
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            Alasan keluar
            <select name="exitReasonId" required className={inputClass}>
              <option value="">Pilih alasan</option>
              {exitReasons.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonDanger}>
            Konfirmasi nonaktif
          </button>
        </form>
      </AnchoredPopover>
    </>
  );
}
