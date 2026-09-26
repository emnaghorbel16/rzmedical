import prisma from '../../config/prisma';
import { StatutBonCommercial, StockMovementType, StatutInventaire } from '../../../generated/prisma/enums';
import { recordStockMovement } from '../stock/stock.service';
import { generateDocumentNumber } from '../exercices/document-numbers.service';

// ─── Stock Dynamique ──────────────────────────────────────────────────────────

export async function getStockDynamiqueCommercial(commercialId: number) {
  // Calcul basé sur les BS validés et BL/Retours
  const bonsSortie = await prisma.bonSortie.findMany({
    where: { commercialId, statut: StatutBonCommercial.VALIDE },
    include: {
      lignes: { include: { produit: { select: { id: true, nom: true, reference: true } } } },
      lignesBL: {
        where: { bon: { statut: { not: 'ANNULE' } } },
        include: { bon: true }
      },
      inventaires: {
        where: { statut: StatutInventaire.VALIDE },
        include: { lignes: true }
      }
    }
  });

  const productMap = new Map<number, { id: number; nom: string; reference: string; quantite: number }>();

  for (const bs of bonsSortie) {
    const bsInventaire = bs.inventaires[0]; // S'il y a un inventaire validé
    
    for (const ligne of bs.lignes) {
      const pId = ligne.produitId;
      if (!productMap.has(pId)) {
        productMap.set(pId, { ...ligne.produit, quantite: 0 });
      }
      const pData = productMap.get(pId)!;
      
      if (bsInventaire) {
        // S'il y a eu un inventaire validé, le stock restant de ce BS pour ce produit est 0 
        // car l'inventaire clôture le BS (il ajuste le stock et le reste est "vendu" ou retourné)
        // Mais techniquement, s'il reste des produits physiquement après inventaire, ils sont toujours au commercial.
        // D'après les règles métiers, l'inventaire compte ce qui reste ("quantiteVoiture").
        // Donc on ajoute la quantiteVoiture.
        const invLigne = bsInventaire.lignes.find(l => l.produitId === pId);
        if (invLigne) {
          pData.quantite += invLigne.quantiteVoiture;
        }
      } else {
        // Quantité issue du BS
        let qte = ligne.quantite;
        
        // Moins ce qui a été vendu via BL lié à ce BS
        const ventes = bs.lignesBL
          .filter(lbl => lbl.produitId === pId && lbl.ligneBonSortieId === ligne.id)
          .reduce((sum, lbl) => sum + lbl.quantiteLivree, 0);
        
        qte -= ventes;
        pData.quantite += qte;
      }
    }
  }

  return Array.from(productMap.values()).filter(p => p.quantite > 0).sort((a, b) => a.nom.localeCompare(b.nom));
}

export async function getAllStocksCommerciaux() {
  const stock = await prisma.stockCommercial.findMany({
    include: {
      commercial: { select: { id: true, nom: true, prenom: true, email: true } },
      produit: { select: { id: true, nom: true, reference: true } }
    }
  });

  return stock
    .filter(s => s.quantite > 0)
    .map(s => ({
      commercial: s.commercial,
      produit: s.produit,
      quantite: s.quantite
    }))
    .sort((a, b) => a.produit.nom.localeCompare(b.produit.nom));
}

// ─── Bon de Sortie ──────────────────────────────────────────────────────────

export async function createBonSortie(data: any) {
  return prisma.$transaction(async (tx) => {
    const code = await generateDocumentNumber(tx as any, 'BON_SORTIE');
    return tx.bonSortie.create({
      data: {
        code,
        commercialId: data.commercialId,
        commentaire: data.commentaire,
        lignes: {
          create: data.lignes.map((l: any) => ({
            produitId: l.produitId,
            quantite: l.quantite,
          })),
        },
      },
      include: { lignes: { include: { produit: true } }, commercial: true },
    });
  });
}

export async function listBonsSortie() {
  return prisma.bonSortie.findMany({
    include: { commercial: true, lignes: { include: { produit: true } }, inventaires: true },
    orderBy: { creeLe: 'desc' },
  });
}

export async function getBonSortie(id: number) {
  return prisma.bonSortie.findUnique({
    where: { id },
    include: { commercial: true, lignes: { include: { produit: true } }, inventaires: true },
  });
}

export async function updateBonSortie(id: number, data: any) {
  const bon = await prisma.bonSortie.findUnique({ where: { id } });
  if (!bon) throw new Error('Bon de sortie introuvable');
  if (bon.statut !== StatutBonCommercial.BROUILLON) throw new Error('Seuls les bons de sortie en brouillon peuvent être modifiés');
  if (!Number.isInteger(Number(data.commercialId))) throw new Error('Commercial invalide');
  const lignes = Array.isArray(data.lignes) ? data.lignes.filter((ligne: any) => Number(ligne.produitId) && Number(ligne.quantite) > 0) : [];
  if (!lignes.length) throw new Error('Ajoutez au moins un produit');
  if (new Set(lignes.map((ligne: any) => Number(ligne.produitId))).size !== lignes.length) throw new Error('Un produit ne peut apparaître qu’une seule fois');

  return prisma.bonSortie.update({
    where: { id },
    data: {
      commercialId: Number(data.commercialId),
      commentaire: typeof data.commentaire === 'string' ? data.commentaire.trim() || null : null,
      lignes: { deleteMany: {}, create: lignes.map((ligne: any) => ({ produitId: Number(ligne.produitId), quantite: Number(ligne.quantite) })) },
    },
    include: { commercial: true, lignes: { include: { produit: true } }, inventaires: true },
  });
}

export async function validerBonSortie(id: number, userId?: number) {
  return prisma.$transaction(async (tx) => {
    const bon = await tx.bonSortie.findUnique({
      where: { id },
      include: { lignes: true },
    });
    if (!bon) throw new Error('Bon introuvable');
    if (bon.statut !== StatutBonCommercial.BROUILLON) throw new Error('Déjà validé ou annulé');

    for (const ligne of bon.lignes) {
      // 1. Dépôt -> Sortie
      await recordStockMovement(tx as any, {
        productId: ligne.produitId,
        quantity: ligne.quantite,
        type: StockMovementType.TRANSFER,
        stockDelta: -ligne.quantite, // sort du dépôt principal
        reference: bon.code,
        sourceType: 'BonSortie',
        sourceId: bon.id,
        userId,
        operationKey: `BS:${bon.id}:${ligne.produitId}`,
      });

      // 2. Mouvement d'entrée fictif pour le commercial pour traçabilité (optionnel)
      await recordStockMovement(tx as any, {
        productId: ligne.produitId,
        quantity: ligne.quantite,
        type: StockMovementType.TRANSFER,
        stockDelta: 0, // Ne touche pas le stock central, c'est juste pour traçabilité
        depot: `COMMERCIAL_${bon.commercialId}`,
        reference: bon.code,
        sourceType: 'BonSortie',
        sourceId: bon.id,
        userId,
        operationKey: `BS_COMMERCIAL:${bon.id}:${ligne.produitId}`,
      });

      // Maintien de l'ancienne table pour rétro-compatibilité
      const existing = await tx.stockCommercial.findUnique({
        where: { commercialId_produitId: { commercialId: bon.commercialId, produitId: ligne.produitId } },
      });
      if (existing) {
        await tx.stockCommercial.update({
          where: { id: existing.id },
          data: { quantite: { increment: ligne.quantite } },
        });
      } else {
        await tx.stockCommercial.create({
          data: { commercialId: bon.commercialId, produitId: ligne.produitId, quantite: ligne.quantite },
        });
      }
    }

    return tx.bonSortie.update({
      where: { id },
      data: { statut: StatutBonCommercial.VALIDE, valideLe: new Date() },
      include: { commercial: true, lignes: { include: { produit: true } } },
    });
  });
}

// ─── Inventaire Commercial ────────────────────────────────────────────────────

export async function listInventaires() {
  return prisma.inventaireCommercial.findMany({
    where: { statut: 'VALIDE' },
    include: { commercial: true, bonSortie: true },
    orderBy: { creeLe: 'desc' },
  });
}

export async function getInventaireByBonSortie(bonSortieId: number) {
  const inv = await prisma.inventaireCommercial.findFirst({
    where: { bonSortieId },
    include: {
      lignes: { include: { produit: { select: { id: true, nom: true, reference: true, cump: true, prixAchat: true } } } },
      bonSortie: true,
      commercial: true
    }
  });
  
  if (!inv) return null;
  
  // Pour les inventaires en brouillon, recalculer les quantités vendues en temps réel
  if (inv.statut === StatutInventaire.BROUILLON) {
    // Agréger les ventes depuis les BL liés (par ligne ou par BL parent)
    const lignesBL = await prisma.ligneBonLivraison.findMany({
      where: {
        OR: [
          { bonSortieId },
          { bon: { bonSortieId } },
        ],
        bon: { statut: { not: 'ANNULE' } },
      },
      select: { produitId: true, quantiteLivree: true }
    });

    const venteParProduit = new Map<number, number>();
    for (const bl of lignesBL) {
      if (bl.produitId) {
        venteParProduit.set(bl.produitId, (venteParProduit.get(bl.produitId) ?? 0) + bl.quantiteLivree);
      }
    }

    let totalEcartQte = 0;
    let totalValeurEcart = 0;
    for (const ligne of inv.lignes) {
      // CUMP en priorité, prixAchat en fallback
      const pmp = Number(ligne.produit.cump) || Number((ligne.produit as any).prixAchat) || 0;
      // Mettre à jour la qté vendue en temps réel
      const venteDynamique = venteParProduit.get(ligne.produitId) ?? ligne.quantiteVendue;
      const restanteDynamique = ligne.quantiteSortie - venteDynamique;
      
      (ligne as any).quantiteVendue = venteDynamique;
      (ligne as any).quantiteRestante = restanteDynamique;
      
      const ecart = ligne.quantiteVoiture - restanteDynamique;
      const val = ecart * pmp;
      ligne.ecart = ecart;
      ligne.pmpSnapshot = pmp as any;
      ligne.valeurEcart = val as any;
      
      totalEcartQte += ecart;
      totalValeurEcart += val;
    }
    (inv as any).totalEcartQte = totalEcartQte;
    (inv as any).totalValeurEcart = totalValeurEcart;
  }
  
  return inv;
}

export async function createInventaireFromBS(bonSortieId: number) {
  return prisma.$transaction(async (tx) => {
    const bs = await tx.bonSortie.findUnique({
      where: { id: bonSortieId },
      include: {
        lignes: { include: { produit: true } },
      }
    });

    if (!bs) throw new Error('Bon de sortie introuvable');
    if (bs.statut !== StatutBonCommercial.VALIDE) throw new Error('Le bon de sortie doit être validé');

    const existing = await tx.inventaireCommercial.findFirst({ where: { bonSortieId } });
    if (existing) return getInventaireByBonSortie(bonSortieId);

    // Calculer les quantités vendues depuis TOUTES les lignes BL liées à ce BS
    // - via ligneBonSortieId (liaison fine ligne-à-ligne)
    // - OU via bonSortieId sur le BL parent (liaison au niveau du document)
    const lignesBLDirectes = await tx.ligneBonLivraison.findMany({
      where: {
        OR: [
          { bonSortieId },          // liaison fine par ligne
          { bon: { bonSortieId } }, // liaison par le BL parent
        ],
        bon: { statut: { not: 'ANNULE' } },
      },
      select: { produitId: true, quantiteLivree: true, ligneBonSortieId: true }
    });

    // Agréger par produitId
    const venteParProduit = new Map<number, number>();
    for (const bl of lignesBLDirectes) {
      if (bl.produitId) {
        venteParProduit.set(bl.produitId, (venteParProduit.get(bl.produitId) ?? 0) + bl.quantiteLivree);
      }
    }

    const code = await generateDocumentNumber(tx as any, 'INVENTAIRE_COMMERCIAL');

    const inv = await tx.inventaireCommercial.create({
      data: {
        code,
        bonSortieId,
        commercialId: bs.commercialId,
        statut: StatutInventaire.BROUILLON,
        lignes: {
          create: bs.lignes.map(l => {
            const vendue = venteParProduit.get(l.produitId) ?? 0;
            const restante = l.quantite - vendue;

            return {
              produitId: l.produitId,
              quantiteSortie: l.quantite,
              quantiteVendue: vendue,
              quantiteRestante: restante,
              quantiteVoiture: restante, // par défaut
              ecart: 0,
              pmpSnapshot: Number(l.produit.cump) || Number(l.produit.prixAchat) || 0,
              valeurEcart: 0
            };
          })
        }
      }
    });

    return getInventaireByBonSortie(bonSortieId);
  });
}

export async function updateLigneInventaire(ligneId: number, quantiteVoiture: number) {
  const ligne = await prisma.ligneInventaire.findUnique({
    where: { id: ligneId },
    include: { inventaire: true, produit: { select: { id: true, cump: true, prixAchat: true } } }
  });
  
  if (!ligne) throw new Error('Ligne introuvable');
  if (ligne.inventaire.statut === StatutInventaire.VALIDE) throw new Error('Inventaire déjà validé');

  const ecart = quantiteVoiture - ligne.quantiteRestante;
  // CUMP en priorité, prixAchat en fallback
  const pmp = Number(ligne.produit.cump) || Number((ligne.produit as any).prixAchat) || 0;
  const valeurEcart = ecart * pmp;

  return prisma.ligneInventaire.update({
    where: { id: ligneId },
    data: {
      quantiteVoiture,
      ecart,
      pmpSnapshot: pmp,
      valeurEcart
    }
  });
}

export async function validerInventaire(id: number, userId?: number) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.inventaireCommercial.findUnique({
      where: { id },
      include: { lignes: true, commercial: true }
    });

    if (!inv) throw new Error('Inventaire introuvable');
    if (inv.statut === StatutInventaire.VALIDE) throw new Error('Déjà validé');

    let totalEcartQte = 0;
    let totalValeurEcart = 0;

    for (const ligne of inv.lignes) {
      totalEcartQte += ligne.ecart;
      totalValeurEcart += Number(ligne.valeurEcart);

      // 1. Si écart différent de zéro, on enregistre l'ajustement pour traçabilité (sans toucher au stock principal)
      if (ligne.ecart !== 0) {
        await recordStockMovement(tx as any, {
          productId: ligne.produitId,
          quantity: Math.abs(ligne.ecart),
          type: StockMovementType.INVENTORY,
          stockDelta: ligne.ecart,
          reference: inv.code,
          sourceType: 'InventaireCommercial',
          sourceId: inv.id,
          userId,
          operationKey: `INVC:${inv.id}:${ligne.produitId}`,
          skipStockUpdate: true,
          depot: `Voiture ${inv.commercial?.prenom} ${inv.commercial?.nom}`,
          nature: 'INVENTORY_ADJUSTMENT'
        });
      }

      // 2. Le stock restant physiquement (voiture) est retourné au dépôt central
      if (ligne.quantiteVoiture > 0) {
        await recordStockMovement(tx as any, {
          productId: ligne.produitId,
          quantity: ligne.quantiteVoiture,
          type: StockMovementType.RETURN,
          stockDelta: ligne.quantiteVoiture, // on AJOUTE au stock principal
          reference: inv.code,
          sourceType: 'InventaireCommercial',
          sourceId: inv.id,
          userId,
          operationKey: `INVC_RETURN:${inv.id}:${ligne.produitId}`,
          skipStockUpdate: false, // Mise à jour effective du stock global
          depot: 'DEPOT PRINCIPAL',
          nature: 'RETOUR_COMMERCIAL'
        });
      }

      // 3. Mise à jour de la table statique du commercial
      // On retire la quantité théorique (restante) de son stock,
      // puisque l'inventaire clôture ce bon et la marchandise est restituée (ou perdue).
      if (ligne.quantiteRestante > 0) {
        const existing = await tx.stockCommercial.findUnique({
          where: { commercialId_produitId: { commercialId: inv.commercialId, produitId: ligne.produitId } }
        });
        if (existing) {
          await tx.stockCommercial.update({
            where: { id: existing.id },
            data: { quantite: { decrement: ligne.quantiteRestante } }
          });
        }
      }
    }

    return tx.inventaireCommercial.update({
      where: { id },
      data: { 
        statut: StatutInventaire.VALIDE, 
        valideLe: new Date(),
        valideParId: userId,
        totalEcartQte,
        totalValeurEcart
      }
    });
  });
}

// ─── Répartition globale ────────────────────────────────────────────────────────

export async function getStockRepartition(produitId: number) {
  const produit = await prisma.produit.findUnique({
    where: { id: produitId },
    select: { stock: true }
  });
  if (!produit) throw new Error('Produit introuvable');

  const stockCommerciaux = await prisma.stockCommercial.findMany({
    where: { produitId, quantite: { gt: 0 } },
    include: { commercial: { select: { nom: true, prenom: true } } }
  });

  const repartition = [];
  let totalCommerciaux = 0;

  for (const sc of stockCommerciaux) {
    repartition.push({ 
      type: 'Commercial', 
      nom: `${sc.commercial.prenom} ${sc.commercial.nom}`, 
      quantite: sc.quantite 
    });
    totalCommerciaux += sc.quantite;
  }

  // Le reste est au dépôt principal
  const depotQuantite = produit.stock - totalCommerciaux;
  if (depotQuantite !== 0) {
    repartition.unshift({ type: 'Dépôt', nom: 'Dépôt Central', quantite: depotQuantite });
  }

  return {
    stockTotal: produit.stock,
    repartition
  };
}
