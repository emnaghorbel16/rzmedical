"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import { useCompany } from "@/providers/CompanyProvider";
import { imageUrl } from "@/lib/api";

type Tone = "dark" | "light";
type Variant = "full" | "mark" | "word";

/**
 * Logo RZMedical
 * Utilise l'image dynamique ou fallback locale
 */
export function Logo({
  variant = "full",
  tone = "dark",
  className,
}: {
  variant?: Variant;
  tone?: Tone;
  className?: string;
}) {
  const isLight = tone === "light";
  const company = useCompany();

  const src = company?.logoUrl ? imageUrl(company.logoUrl) : "/images/logo/logo-rzmedical.png";
  const alt = company?.nomSociete || "RZMedical";

  return (
    <div className={cn(
      "relative flex items-center h-12 w-[80px] shrink-0 sm:h-14 sm:w-[100px]",
      
      className
    )}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 80px, 100px"
        className="object-contain object-left"
        priority
      />
    </div>
  );
}
