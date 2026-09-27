"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { imageUrl } from "@/lib/api";
import { clientPrice, formatTND } from "@/lib/format";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { buttonVariants } from "@/components/ui/Button";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CartIcon,
  LockIcon,
  PackageIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const round2 = (x: number) => Math.round(x * 100) / 100;

export function CartView() {
  const { items, ready, count, subtotal, isEmpty, setQuantity, removeItem } =
    useCart();
  const { isAuthenticated, user } = useAuth();
  const remiseClient = isAuthenticated ? user?.remise ?? 0 : 0;

  const clientTotal = useMemo(() => {
    if (remiseClient <= 0) return subtotal;
    return round2(
      items.reduce(
        (sum, i) => sum + clientPrice(i.prix, i.remise, remiseClient) * i.quantite,
        0,
      ),
    );
  }, [items, remiseClient, subtotal]);

  const loyaltySavings = round2(subtotal - clientTotal);

  // Avant hydratation du panier (localStorage) : squelette pour éviter un flash.
  if (!ready) {
    return (
      <Container className="py-10">
        <Skeleton className="h-8 w-40" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </Container>
    );
  }

  if (isEmpty) {
    return (
      <Container className="py-10">
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">Panier</h1>
        <EmptyState
          className="mt-6 rounded-2xl border border-border bg-surface"
          icon={<CartIcon size={30} />}
          title="Votre panier est vide"
          description="Parcourez notre catalogue et ajoutez les produits dont vous avez besoin."
          action={
            <Link
              href="/catalogue"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              Découvrir le catalogue
              <ArrowRightIcon size={18} />
            </Link>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="py-8 lg:py-10">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
          Panier
          <span className="ml-2 text-base font-medium text-muted">
            ({count} article{count > 1 ? "s" : ""})
          </span>
        </h1>
        <Link
          href="/catalogue"
          className="hidden items-center gap-1.5 text-sm font-semibold text-azure-600 transition-colors hover:text-azure-700 sm:inline-flex"
        >
          <ArrowLeftIcon size={16} />
          Continuer mes achats
        </Link>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Lignes */}
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {items.map((item) => {
            const unitHT = clientPrice(item.prix, item.remise, remiseClient);
            const unit = unitHT * (1 + (item.tva ?? 0) / 100);
            const lineTotal = round2(unit * item.quantite);
            const outOfStock = !item.disponibleALaVente;

            return (
              <li key={item.produitId} className="flex gap-4 p-4 sm:p-5">
                <Link
                  href={`/produit/${encodeURIComponent(item.reference)}`}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-white"
                >
                  {item.image ? (
                    <Image
                      src={imageUrl(item.image)}
                      alt={item.nom}
                      fill
                      sizes="96px"
                      className="object-contain p-2"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-faint">
                      <PackageIcon size={28} />
                    </span>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/produit/${encodeURIComponent(item.reference)}`}
                        className="line-clamp-2 text-[15px] font-semibold text-navy-900 transition-colors hover:text-azure-600"
                      >
                        {item.nom}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        Réf. {item.reference}
                      </p>
                      {outOfStock && (
                        <Badge variant="error" size="sm" className="mt-1.5">
                          Indisponible
                        </Badge>
                      )}
                    </div>
                    <IconButton
                      label="Retirer du panier"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.produitId)}
                      className="-mr-1 -mt-1 shrink-0 text-faint hover:text-error"
                    >
                      <TrashIcon size={18} />
                    </IconButton>
                  </div>

                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                    <QuantityStepper
                      size="sm"
                      value={item.quantite}
                      min={1}
                      max={undefined}
                      onChange={(q) => setQuantity(item.produitId, q)}
                    />
                    <div className="text-right">
                      <p className="text-base font-bold tabular-nums text-navy-900">
                        {formatTND(lineTotal)}
                      </p>
                      {item.quantite > 1 && (
                        <p className="text-xs text-muted">
                          {formatTND(unit)} / unité
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Récapitulatif */}
        <aside className="lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-base font-bold text-navy-900">Récapitulatif</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Sous-total</dt>
                <dd className="font-semibold tabular-nums text-navy-900">
                  {formatTND(subtotal)}
                </dd>
              </div>
              {remiseClient > 0 && (
                <div className="flex justify-between text-success-dark">
                  <dt className="inline-flex items-center gap-1.5">
                    Remise fidélité (-{Math.round(remiseClient)}%)
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    −{formatTND(loyaltySavings)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Livraison</dt>
                <dd className="text-muted">Calculée à la commande</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm font-medium text-navy-700">Total</span>
              <span className="font-display text-2xl font-bold tabular-nums text-navy-900">
                {formatTND(clientTotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-faint">TVA incluse, en Dinar Tunisien</p>

            <Link
              href={isAuthenticated ? "/commande" : "/inscription?next=/commande"}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg", fullWidth: true }),
                "mt-5",
              )}
            >
              Passer la commande
              <ArrowRightIcon size={18} />
            </Link>

            {!isAuthenticated && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
                <LockIcon size={13} />
                Connexion requise à la validation
              </p>
            )}

            <Link
              href="/catalogue"
              className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-azure-600 transition-colors hover:text-azure-700 sm:hidden"
            >
              <ArrowLeftIcon size={16} />
              Continuer mes achats
            </Link>
          </div>

          {/* Réassurance compacte */}
          <p className="mt-4 text-center text-xs leading-relaxed text-muted">
            Paiement à la livraison possible · Produits certifiés · Livraison
            partout en Tunisie
          </p>
        </aside>
      </div>
    </Container>
  );
}
