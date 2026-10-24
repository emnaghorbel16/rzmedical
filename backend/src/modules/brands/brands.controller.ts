import { Request, Response } from 'express';
import * as service from './brands.service';

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
    if (!data) return res.status(404).json({ error: 'Marque non trouvée' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const { nom, categorieId, logo } = req.body;
    if (!nom || !categorieId) return res.status(400).json({ error: 'Nom et categorieId sont requis' });
    const data = await service.create({ nom, categorieId: Number(categorieId), logo });
    res.status(201).json(data);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Cette marque existe déjà pour cette catégorie' });
    res.status(500).json({ error: err.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const { nom, categorieId, logo } = req.body;
    const data = await service.update(Number(req.params.id), {
      ...(nom !== undefined ? { nom: nom.trim() } : {}),
      ...(categorieId !== undefined ? { categorieId: Number(categorieId) } : {}),
      ...(logo !== undefined ? { logo: logo ? logo.trim() : null } : {})
    });
    res.json(data);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Marque non trouvée' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Cette marque existe déjà pour cette catégorie' });
    res.status(500).json({ error: err.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    await service.remove(Number(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Marque non trouvée' });
    res.status(500).json({ error: err.message });
  }
};
