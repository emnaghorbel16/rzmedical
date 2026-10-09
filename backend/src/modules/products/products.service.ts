import prisma from '../../config/prisma';
import { StockMovementType } from '../../../generated/prisma/enums';
import { recordStockMovement } from '../stock/stock.service';

// Include complet pour les routes ADMIN uniquement (contient les données internes)
const productInclude = {
  sousCategorie: { include: { categorie: true } },
  marque: true,
  mouvementsStock: {
    where: { type: 'PURCHASE' },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { unitPrice: true },
  },
} as const;

// Select allégé pour les routes publiques (catalogue web) — sans données commerciales internes
const publicProductSelect = {
  id: true,
  nom: true,
  reference: true,
  description: true,
  prix: true,
  tva: true,
  remise: true,
  images: true,
  video: true,
  motsCles: true,
  ficheTechnique: true,
  disponible: true,
  disponibleALaVente: true,
  misEnAvantSousCat: true,
  expirationDate: true,
  creeLe: true,
  misAJourLe: true,
  sousCategorieId: true,
  marqueId: true,
  paysFabrication: true,
  sousCategorie: { include: { categorie: true } } as any,
  marque: true as any,
} as const;

export interface ProductQuery {
  filter?: string;          // héritage : 'new' | 'promo'
  categorieId?: number;
  sousCategorieId?: number;
  marqueId?: number;
  category?: string;        // nom ou slug de catégorie
  subcategory?: string;     // nom ou slug de sous-catégorie
  brand?: string;           // nom ou slug de marque
  q?: string;               // recherche texte
  promo?: boolean;          // uniquement les produits en promotion
  disponible?: boolean;
  disponibleALaVente?: boolean;
  misEnAvantSousCat?: boolean;
  minPrix?: number;
  maxPrix?: number;
  sort?: string;            // 'recent' | 'prix-asc' | 'prix-desc' | 'nom' | 'remise'
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  products: T[];
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  pageSize: number;
}

export const getAll = async (query: ProductQuery = {}) => {
  // Raccourcis historiques sans pagination explicite
  if (query.filter === 'new' && !query.page) return getNew(query.limit || 20);
  if (query.filter === 'promo' && !query.page && !query.categorieId && !query.category) return getPromo();

  const where: any = {};
  const and: any[] = [];

  if (query.categorieId) {
    where.sousCategorie = { ...(where.sousCategorie || {}), categorieId: query.categorieId };
  } else if (query.category) {
    const catSearch = query.category.trim();
    where.sousCategorie = {
      ...(where.sousCategorie || {}),
      categorie: {
        nom: { equals: catSearch, mode: 'insensitive' },
      },
    };
  }

  if (query.sousCategorieId) {
    where.sousCategorieId = query.sousCategorieId;
  } else if (query.subcategory) {
    where.sousCategorie = {
      ...(where.sousCategorie || {}),
      nom: { equals: query.subcategory.trim(), mode: 'insensitive' },
    };
  }

  if (query.marqueId) {
    where.marqueId = query.marqueId;
  } else if (query.brand) {
    where.marque = {
      nom: { equals: query.brand.trim(), mode: 'insensitive' },
    };
  }

  if (query.disponible !== undefined) where.disponible = query.disponible;
  if (query.misEnAvantSousCat !== undefined) where.misEnAvantSousCat = query.misEnAvantSousCat;
  if (query.promo || query.filter === 'promo') where.remise = { gt: 0 };
  if (query.minPrix !== undefined || query.maxPrix !== undefined) {
    where.prix = {};
    if (query.minPrix !== undefined) where.prix.gte = query.minPrix;
    if (query.maxPrix !== undefined) where.prix.lte = query.maxPrix;
  }
  if (query.q && query.q.trim()) {
    const q = query.q.trim();
    const qLower = q.toLowerCase();
    const qUpper = q.toUpperCase();
    const qCap = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase();
    
    and.push({
      OR: [
        { nom: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { motsCles: { hasSome: [q, qLower, qUpper, qCap] } },
        { marque: { nom: { contains: q, mode: 'insensitive' } } },
        { sousCategorie: { nom: { contains: q, mode: 'insensitive' } } },
        { sousCategorie: { categorie: { nom: { contains: q, mode: 'insensitive' } } } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const orderBy =
    query.sort === 'prix-asc' ? { prix: 'asc' as const } :
    query.sort === 'prix-desc' ? { prix: 'desc' as const } :
    query.sort === 'nom' ? { nom: 'asc' as const } :
    query.sort === 'remise' ? { remise: 'desc' as const } :
    { creeLe: 'desc' as const };

  const whereClause = Object.keys(where).length ? where : undefined;

  // Si pagination demandée
  if (query.page !== undefined && query.page > 0) {
    const pageSize = Math.max(1, query.limit && query.limit > 0 ? query.limit : 12);
    const currentPage = query.page;
    const skip = (currentPage - 1) * pageSize;

    const [totalProducts, products] = await Promise.all([
      prisma.produit.count({ where: whereClause }),
      prisma.produit.findMany({
        where: whereClause,
        select: publicProductSelect,
        orderBy,
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(totalProducts / pageSize) || 1;

    return {
      products,
      currentPage,
      totalPages,
      totalProducts,
      pageSize,
    };
  }

  return prisma.produit.findMany({
    where: whereClause,
    select: publicProductSelect,
    orderBy,
    ...(query.limit && query.limit > 0 ? { take: query.limit } : {}),
  });
};


// getNew : version publique sans données internes
export const getNew = (limit: number = 20) =>
  prisma.produit.findMany({
    take: limit,
    select: publicProductSelect,
    orderBy: { creeLe: 'desc' },
  });

// getNew admin : version complète avec mouvements de stock
export const getNewAdmin = (limit: number = 20) =>
  prisma.produit.findMany({
    take: limit,
    include: productInclude,
    orderBy: { creeLe: 'desc' },
  });

// getPromo : version publique sans données internes
export const getPromo = () =>
  prisma.produit.findMany({
    where: {
      remise: { gt: 0 },
    },
    select: publicProductSelect,
    orderBy: { remise: 'desc' },
  });

// getPromo admin : version complète
export const getPromoAdmin = () =>
  prisma.produit.findMany({
    where: { remise: { gt: 0 } },
    include: productInclude,
    orderBy: { remise: 'desc' },
  });

// getById : version publique sans données internes
export const getById = (id: number) =>
  prisma.produit.findUnique({
    where: { id },
    select: publicProductSelect,
  });

// getById admin : version complète
export const getByIdAdmin = (id: number) =>
  prisma.produit.findUnique({
    where: { id },
    include: productInclude,
  });

// getByReference : version publique sans données internes
export const getByReference = (reference: string) =>
  prisma.produit.findUnique({
    where: { reference },
    select: publicProductSelect,
  });

// getByReference admin : version complète
export const getByReferenceAdmin = (reference: string) =>
  prisma.produit.findUnique({
    where: { reference },
    include: productInclude,
  });

export const create = async (data: {
  nom: string;
  reference: string;
  description?: string;
  expirationDate?: Date | null;
  prix: number;
  prixAchat?: number | null;
  tva?: number;
  remise?: number;
  stock?: number;
  images?: string[];
  video?: string;
  motsCles?: string[];
  ficheTechnique?: string;
  disponible?: boolean;
  disponibleALaVente?: boolean;
  misEnAvantSousCat?: boolean;
  sousCategorieId: number;
  marqueId: number;
}) => prisma.$transaction(async (tx) => {
  const initialStock = Math.trunc(Number(data.stock ?? 0));
  const produit = await tx.produit.create({
    data: { ...data, stock: 0 },
  });

  if (initialStock !== 0) {
    await recordStockMovement(tx, {
      productId: produit.id,
      quantity: Math.abs(initialStock),
      type: StockMovementType.INVENTORY,
      stockDelta: initialStock,
      reference: produit.reference,
      sourceType: 'PRODUCT_INITIAL_STOCK',
      sourceId: produit.id,
    });
  }

  return tx.produit.findUnique({ where: { id: produit.id }, include: productInclude });
});

export const update = async (id: number, data: any) => {
  const requestedStock = data.stock === undefined ? undefined : Math.trunc(Number(data.stock));
  const updateData = { ...data };
  delete updateData.stock;

  return prisma.$transaction(async (tx) => {
    const current = await tx.produit.findUnique({ where: { id }, select: { stock: true, reference: true } });
    if (!current) {
      const error = new Error('Produit non trouvé');
      (error as any).code = 'P2025';
      throw error;
    }

    const updated = await tx.produit.update({ where: { id }, data: updateData, include: productInclude });
    if (requestedStock !== undefined && requestedStock !== current.stock) {
      const delta = requestedStock - current.stock;
      await recordStockMovement(tx, {
        productId: id,
        quantity: Math.abs(delta),
        type: StockMovementType.ADJUSTMENT,
        stockDelta: delta,
        reference: current.reference,
        sourceType: 'PRODUCT_ADJUSTMENT',
        sourceId: id,
      });
    }

    return tx.produit.findUnique({ where: { id: updated.id }, include: productInclude });
  });
};

export const remove = (id: number) =>
  prisma.produit.delete({ where: { id } });
