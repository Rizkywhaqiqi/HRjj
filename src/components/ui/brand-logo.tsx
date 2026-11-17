import Image from "next/image";
import { cn } from "./primitives";

export function BrandLogo({ className, sizes }: { className?: string; sizes: string }) {
  return (
    <div className={cn("relative aspect-[1.85] shrink-0 overflow-hidden bg-white", className)}>
      <Image
        src="/images/jojo-logo.jpg"
        alt="Logo JOJO GROUP"
        fill
        sizes={sizes}
        className="object-cover"
      />
    </div>
  );
}
