import prisma from '../../config/prisma';

export const getAll = (query?: { categorieId?: number }) =>
  prisma.marque.findMany({
    where: query?.categorieId ? { categorieId: query.categorieId } : undefined,
    include: { categorie: true, _count: { select: { produits: true } } },
    orderBy: { creeLe: 'desc' },
  });

export const getById = (id: number) =>
  prisma.marque.findUnique({ where: { id }, include: { categorie: true } });

export const create = (data: { nom: string; categorieId: number; logo?: string }) =>
  prisma.marque.create({ data });

export const update = (id: number, data: { nom?: string; categorieId?: number; logo?: string | null }) =>
  prisma.marque.update({
    where: { id },
    data,
    include: { categorie: true, _count: { select: { produits: true } } },
  });

export const remove = (id: number) =>
  prisma.marque.delete({ where: { id } });
