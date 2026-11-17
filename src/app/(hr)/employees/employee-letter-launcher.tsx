import Link from "next/link";
import { buttonSecondary } from "@/components/ui/primitives";
import type { LetterType } from "@/modules/letters/schema";
interface Props {
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
    positionName: string;
    companyName: string;
    locationName: string;
    joinDate: string | null;
  };
  availableTypes: LetterType[];
  issuedDate: string;
  createAction: (data: FormData) => Promise<void>;
}
export default function EmployeeLetterLauncher({ employee }: Props) {
  return (
    <Link
      href={`/letters?employeeId=${employee.id}`}
      className={buttonSecondary}
    >
      Buat surat
    </Link>
  );
}
