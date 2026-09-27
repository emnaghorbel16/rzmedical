import { imageUrl } from "@/lib/api";
import { Container } from "@/components/ui/Container";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/Breadcrumb";
import { cn } from "@/lib/cn";

/** Bandeau catalogue premium avec effets 3D et ambiants. */
export function SubcategoryBanner({
  name,
  image,
  breadcrumb,
  titleAs = "h1",
}: {
  name: string;
  image?: string | null;
  breadcrumb: BreadcrumbItem[];
  titleAs?: "h1" | "p";
  isLogo?: boolean;
}) {
  const Title = titleAs;
  const bg = image ? imageUrl(image) : null;

  return (
    <>
      <section
        className={cn(
          "relative flex items-center justify-center overflow-hidden border-b border-white/[0.08]",
          bg ? "min-h-[12rem] sm:min-h-[16rem]" : "min-h-[10rem] sm:min-h-[14rem] bg-slate-900",
        )}
        style={{
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)"
        }}
      >
        {/* Background base & image */}
        {bg && !isLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center scale-105 blur-[2px]"
          />
        ) : null}

        {/* Overlays and gradients */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 z-0",
            bg && !isLogo
              ? "bg-gradient-to-r from-navy-960/85 via-navy-960/60 to-navy-960/85"
              : "bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950"
          )}
        />

        {/* Subtle top border highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-white/10 pointer-events-none z-10" />

        {/* Content */}
        <Container className="relative z-10 py-5 sm:py-6">
          <div className="mx-auto max-w-3xl text-center flex flex-col items-center">
            {bg && isLogo ? (
              <div className="mb-4 bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bg}
                  alt={name}
                  className="h-20 sm:h-28 w-auto object-contain drop-shadow-md"
                />
              </div>
            ) : null}
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-azure-400/25 bg-azure-500/10 px-3.5 py-1 mb-3 select-none">
              <span className="h-px w-4 bg-azure-400/60" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-azure-300">
                Sélection du catalogue
              </span>
            </div>
            
            <Title className="font-display text-2xl font-black tracking-tight text-white drop-shadow-md sm:text-3xl">
              {name}
            </Title>
          </div>
        </Container>
      </section>

      {/* Breadcrumb section */}
      <nav className="border-b border-slate-200/80 bg-slate-50/50 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-white/50 pointer-events-none" />
        <Container className="py-2.5">
          <Breadcrumb items={breadcrumb} className="mb-0 text-[12px] sm:text-[13px]" />
        </Container>
      </nav>
    </>
  );
}
