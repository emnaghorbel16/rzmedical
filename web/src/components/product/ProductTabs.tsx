import type { Produit } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { imageUrl } from "@/lib/api";
import { PdfPages } from "./PdfPages";

function renderDescription(value: string) {
  const parts = value.split(/(\*[^*]+\*|_[^_]+_|\[(?:red|blue|green)\][\s\S]*?\[\/(?:red|blue|green)\])/g).filter(Boolean);
  return parts.map((part, index) => {
    const bold = part.match(/^\*([^*]+)\*$/); if (bold) return <strong key={index} className="font-bold">{bold[1]}</strong>;
    const italic = part.match(/^_([^_]+)_$/); if (italic) return <em key={index} className="italic">{italic[1]}</em>;
    const color = part.match(/^\[(red|blue|green)\]([\s\S]*?)\[\/\1\]$/); 
    if (color) {
      const colorValue = color[1] === "red" ? "text-red-600" : color[1] === "blue" ? "text-blue-600" : "text-green-600";
      return <span key={index} className={colorValue}>{color[2]}</span>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function ProductTabs({ product }: { product: Produit }) {
  const description = product.description?.trim();
  const paragraphs = description ? description.split(/\n{2,}|\r\n{2,}/) : [];

  const isYoutube = (url: string) => url.includes("youtube.com") || url.includes("youtu.be");

  const getYoutubeEmbed = (url: string) => {
    let videoId = "";
    if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1]?.split("?")[0];
    else if (url.includes("v=")) videoId = url.split("v=")[1]?.split("&")[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-lg font-bold text-navy-900">Description</h2>
        {paragraphs.length > 0 ? (
          <div className="max-w-3xl space-y-4 text-[15px] leading-relaxed text-navy-700">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {renderDescription(p)}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Aucune description détaillée n&apos;est disponible pour ce produit.
            Contactez-nous pour toute information complémentaire.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-navy-900">Caractéristiques</h2>
        <dl className="max-w-2xl divide-y divide-border">
          <Row label="Référence" value={product.reference} />
          {product.marque?.nom && <Row label="Marque" value={product.marque.nom} />}
          {product.sousCategorie?.categorie?.nom && (
            <Row label="Catégorie" value={product.sousCategorie.categorie.nom} />
          )}
          {product.sousCategorie?.nom && (
            <Row label="Sous-catégorie" value={product.sousCategorie.nom} />
          )}
          <Row
            label="Disponibilité"
            value={
              product.disponibleALaVente ? "Disponible à la vente" : "Indisponible"
            }
          />
          {product.expirationDate && (
            <Row label="Date de péremption" value={formatDate(product.expirationDate)} />
          )}
          {(product.motsCles ?? []).length > 0 && (
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:gap-6">
              <dt className="w-full text-sm text-muted sm:w-48 sm:shrink-0">
                Mots-clés
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {product.motsCles.map((m) => (
                  <Badge key={m} variant="neutral" size="sm">
                    {m}
                  </Badge>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {product.video && (
        <section>
          <h2 className="mb-4 text-lg font-bold text-navy-900">Vidéo</h2>
          <div className="aspect-video max-w-4xl overflow-hidden rounded-xl border border-border bg-black">
            {isYoutube(product.video) ? (
              <iframe
                src={getYoutubeEmbed(product.video)}
                title="Vidéo du produit"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            ) : (
              <video
                src={imageUrl(product.video)}
                controls
                className="h-full w-full object-contain"
                preload="metadata"
              >
                Votre navigateur ne supporte pas la balise vidéo.
              </video>
            )}
          </div>
        </section>
      )}

      {product.ficheTechnique && (
        <section>
          <h2 className="mb-4 text-lg font-bold text-navy-900">Fiche technique</h2>
          <PdfPages src={imageUrl(product.ficheTechnique)} />
          <div className="mt-4">
            <a
              href={imageUrl(product.ficheTechnique)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-azure-600 transition-colors hover:text-azure-700"
            >
              Télécharger le PDF
            </a>
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
      <dt className="w-full text-sm text-muted sm:w-48 sm:shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-navy-900">{value}</dd>
    </div>
  );
}
