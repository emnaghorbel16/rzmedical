import { Request, Response } from 'express';
import * as service from './subcategories.service';

export const getAll = async (req: Request, res: Response) => {
  try {
    const categorieId = req.query.categorieId ? Number(req.query.categorieId) : undefined;
    const data = await service.getAll(categorieId ? { categorieId } : undefined);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const data = await service.getById(Number(req.params.id));
    if (!data) return res.status(404).json({ error: 'Sous-catégorie non trouvée' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const { nom, categorieId, image, description } = req.body;
    if (!nom || !categorieId) return res.status(400).json({ error: 'Nom et categorieId sont requis' });
    const data = await service.create({ nom, categorieId: Number(categorieId), image, description });
    res.status(201).json(data);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Cette sous-catégorie existe déjà pour cette catégorie' });
    res.status(500).json({ error: err.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const { nom, categorieId, image, description } = req.body;
    const data = await service.update(Number(req.params.id), {
      nom,
      description,
      ...(categorieId ? { categorieId: Number(categorieId) } : {}),
      image
    });
    res.json(data);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Sous-catégorie non trouvée' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Cette sous-catégorie existe déjà pour cette catégorie' });
    res.status(500).json({ error: err.message });
  }
};

export const reorder = async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Un tableau items est requis' });
    }
    await service.reorder(items);
    res.json({ message: 'Ordre mis à jour avec succès' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    await service.remove(Number(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Sous-catégorie non trouvée' });
    res.status(500).json({ error: err.message });
  }
};

export const setFeaturedProducts = async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds)) {
      return res.status(400).json({ error: 'productIds doit être un tableau' });
    }
    await service.setFeaturedProducts(Number(req.params.id), productIds);
    res.json({ message: 'Produits en avant mis à jour avec succès' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
