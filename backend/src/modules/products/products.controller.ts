import { Request, Response } from 'express';
import * as service from './products.service';

const toNum = (v: unknown): number | undefined => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};
const toBool = (v: unknown): boolean | undefined =>
  v === undefined ? undefined : v === 'true' || v === '1';

export const getAll = async (req: Request, res: Response) => {
  try {
    const q = req.query;
    const data = await service.getAll({
      filter: q.filter as string | undefined,
      categorieId: toNum(q.categorieId),
      sousCategorieId: toNum(q.sousCategorieId),
      marqueId: toNum(q.marqueId),
      category: q.category as string | undefined,
      subcategory: q.subcategory as string | undefined,
      brand: q.brand as string | undefined,
      q: q.q as string | undefined,
      promo: toBool(q.promo),
      disponible: toBool(q.disponible),
      misEnAvantSousCat: toBool(q.misEnAvantSousCat),
      minPrix: toNum(q.minPrix),
      maxPrix: toNum(q.maxPrix),
      sort: q.sort as string | undefined,
      page: toNum(q.page),
      limit: toNum(q.limit),
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getNew = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const data = await service.getNew(limit);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getPromo = async (req: Request, res: Response) => {
  try {
    const data = await service.getPromo();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const data = await service.getById(Number(req.params.id));
    if (!data) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getByReference = async (req: Request, res: Response) => {
  try {
    const data = await service.getByReference(String(req.params.reference));
    if (!data) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const { nom, reference, description, expirationDate, prix, prixAchat, tva, remise, stock, images, video, motsCles, ficheTechnique, disponible, disponibleALaVente, misEnAvantSousCat, sousCategorieId, marqueId } = req.body;
    if (!nom || !reference || prix === undefined || !sousCategorieId || !marqueId) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    const data = await service.create({
      nom, reference, description, expirationDate: expirationDate ? new Date(expirationDate) : null, prix: Number(prix), prixAchat: prixAchat !== undefined && prixAchat !== null ? Number(prixAchat) : null, tva: tva !== undefined ? Number(tva) : 0, remise: remise !== undefined ? Number(remise) : 0, stock: stock ? Number(stock) : 0,
      images, video, motsCles, ficheTechnique, disponible, disponibleALaVente: disponibleALaVente ?? disponible ?? true, misEnAvantSousCat, sousCategorieId: Number(sousCategorieId), marqueId: Number(marqueId)
    });
    res.status(201).json(data);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Cette référence de produit existe déjà' });
    res.status(500).json({ error: err.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const updateData = { ...req.body };
    if (updateData.prix !== undefined) updateData.prix = Number(updateData.prix);
    if (updateData.prixAchat !== undefined) updateData.prixAchat = updateData.prixAchat !== null ? Number(updateData.prixAchat) : null;
    if (updateData.tva !== undefined) updateData.tva = Number(updateData.tva);
    if (updateData.remise !== undefined) updateData.remise = Number(updateData.remise);
    if (updateData.stock !== undefined) updateData.stock = Number(updateData.stock);
    if (updateData.disponibleALaVente === undefined && updateData.disponible !== undefined) {
      updateData.disponibleALaVente = updateData.disponible;
    }
    if (updateData.sousCategorieId !== undefined) updateData.sousCategorieId = Number(updateData.sousCategorieId);
    if (updateData.marqueId !== undefined) updateData.marqueId = Number(updateData.marqueId);
    if (updateData.expirationDate !== undefined) updateData.expirationDate = updateData.expirationDate ? new Date(updateData.expirationDate) : null;

    const data = await service.update(Number(req.params.id), updateData);
    res.json(data);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Produit non trouvé' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Cette référence existe déjà' });
    res.status(500).json({ error: err.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    await service.remove(Number(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Produit non trouvé' });
    res.status(500).json({ error: err.message });
  }
};

export const getStockRepartition = async (req: Request, res: Response) => {
  try {
    const { getStockRepartition } = await import('../stock-commercial/stock-commercial.service');
    const data = await getStockRepartition(Number(req.params.id));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
