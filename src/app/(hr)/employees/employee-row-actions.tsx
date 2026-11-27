"use client";

import { SubmitButton } from "@/components/ui/form";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  FilePlus2,
  History,
  UserX,
  ArrowLeft,
} from "lucide-react";
import { AnchoredPopover } from "@/components/ui/anchored-popover";
import { buttonDanger, inputClass } from "@/components/ui/primitives";
interface Props {
  id: number;
  name: string;
  active: boolean;
  canEdit: boolean;
  canCreateLetter: boolean;
  canViewLetters: boolean;
  canDeactivate: boolean;
  exitReasons: { id: number; name: string }[];
  deactivateAction: (data: FormData) => Promise<void>;
}
export default function EmployeeRowActions({
  id,
  name,
  active,
  canEdit,
  canCreateLetter,
  canViewLetters,
  canDeactivate,
  exitReasons,
  deactivateAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    setConfirm(false);
  }, []);
  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600";
  if (
    !canEdit &&
    !canCreateLetter &&
    !canViewLetters &&
    !(canDeactivate && active)
  )
    return null;
  return (
    <>
      <button
        type="button"
        ref={anchor}
        aria-label={`Aksi lainnya untuk ${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <MoreHorizontal size={19} />
      </button>
      <AnchoredPopover
        open={open}
        onClose={close}
        anchorRef={anchor}
        align="end"
        width={288}
        className="p-2"
        ariaLabel={`Aksi karyawan ${name}`}
      >
        {confirm ? (
          <form action={deactivateAction} className="grid gap-3 p-2">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500"
            >
              <ArrowLeft size={14} />
              Kembali
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Nonaktifkan karyawan?
              </p>
              <p className="mt-1 break-words text-xs text-slate-500">
                {name}. Riwayat karyawan tetap tersimpan.
              </p>
            </div>
            <input type="hidden" name="employeeId" value={id} />
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Tanggal keluar
              <input
                name="exitDate"
                type="date"
                required
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Alasan keluar
              <select
                name="exitReasonId"
                required
                defaultValue=""
                className={inputClass}
              >
                <option value="">Pilih alasan</option>
                {exitReasons.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton unstyled className={buttonDanger}>
              Konfirmasi nonaktifkan
            </SubmitButton>
          </form>
        ) : (
          <>
            <p className="truncate px-3 pb-2 pt-1 text-xs font-semibold text-slate-400">
              {name}
            </p>
            {canEdit ? (
              <Link
                href={`/employees/${id}?mode=edit`}
                onClick={close}
                className={item}
              >
                <Pencil size={16} />
                Edit data karyawan
              </Link>
            ) : null}
            {canCreateLetter && active ? (
              <Link
                href={`/letters?employeeId=${id}`}
                onClick={close}
                className={item}
              >
                <FilePlus2 size={16} />
                Buat surat
              </Link>
            ) : null}
            {canViewLetters ? (
              <Link
                href={`/letters?employeeId=${id}`}
                onClick={close}
                className={item}
              >
                <History size={16} />
                Riwayat surat
              </Link>
            ) : null}
            {canDeactivate && active ? (
              <div className="mt-1 border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirm(true)}
                  className={`${item} text-rose-700 hover:bg-rose-50`}
                >
                  <UserX size={16} />
                  Nonaktifkan karyawan
                </button>
              </div>
            ) : null}
          </>
        )}
      </AnchoredPopover>
    </>
  );
}
