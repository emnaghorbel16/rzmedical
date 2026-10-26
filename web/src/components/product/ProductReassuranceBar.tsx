import { TruckIcon, ShieldCheckIcon, PackageIcon } from "@/components/ui/icons";

/**
 * Barre de réassurance horizontale affichée sous la galerie d'images et la carte d'achat.
 */
export function ProductReassuranceBar() {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {/* Livraison */}
        <div className="flex items-center gap-3.5 sm:px-4 first:sm:pl-0">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-azure-50 text-azure-600 border border-azure-100/70 shadow-2xs">
            <TruckIcon size={24} />
          </span>
          <div className="min-w-0">
            <h4 className="text-[14px] font-bold text-navy-900">Livraison 24-48h</h4>
            <p className="text-[12px] text-slate-500 font-medium">On expédie depuis Sfax dès validation.</p>
          </div>
        </div>

        {/* Certifié */}
        <div className="flex items-center gap-3.5 pt-5 sm:pt-0 sm:px-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/70 shadow-2xs">
            <ShieldCheckIcon size={24} />
          </span>
          <div className="min-w-0">
            <h4 className="text-[14px] font-bold text-navy-900">Certifié & Traçable</h4>
            <p className="text-[12px] text-slate-500 font-medium">Certificat de conformité CE.</p>
          </div>
        </div>

        {/* Emballage */}
        <div className="flex items-center gap-3.5 pt-5 sm:pt-0 sm:px-4 last:sm:pr-0">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/70 shadow-2xs">
            <PackageIcon size={24} />
          </span>
          <div className="min-w-0">
            <h4 className="text-[14px] font-bold text-navy-900">Emballage sécurisé</h4>
            <p className="text-[12px] text-slate-500 font-medium">Colis médical renforcé.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
