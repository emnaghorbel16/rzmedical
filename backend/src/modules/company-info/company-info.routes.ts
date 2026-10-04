import { Router, Request, Response } from 'express';
import prisma from '../../config/prisma';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// Récupérer ou initialiser le singleton
async function getOrCreate() {
  const existing = await prisma.infoSociete.findUnique({ where: { id: 1 } });
  if (existing) {
    const valeursTva = Array.isArray(existing.valeursTva) ? existing.valeursTva : [];
    const valeursTimbre = Array.isArray(existing.valeursTimbre) ? existing.valeursTimbre : [];

    // Initialiser les listes fiscales vides avec des valeurs par défaut neutres
    if (valeursTva.length > 0 && valeursTimbre.length > 0) return existing;

    return prisma.infoSociete.update({
      where: { id: 1 },
      data: {
        ...(valeursTva.length === 0 && { valeursTva: [0, 7, 13, 19] }),
        ...(valeursTimbre.length === 0 && { valeursTimbre: [Number(existing.timbreFiscal ?? 1)] }),
      },
    });
  }

  // Création initiale : aucune donnée réelle codée en dur
  return prisma.infoSociete.create({
    data: {
      id: 1,
      valeursTva: [0, 7, 13, 19],
      valeursTimbre: [1],
    },
  });
}

// GET /api/company-info — Public (données de présentation uniquement, sans données bancaires/fiscales)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const info = await getOrCreate();
    // Filtrer les champs sensibles : RIB, banque, matriculeFiscale, retenueSurce, timbreFiscal
    // Ces données ne sont retournées qu'à l'administration authentifiée
    const publicInfo = {
      id: info.id,
      nomSociete: info.nomSociete,
      logoUrl: info.logoUrl,
      telephone: info.telephone,
      fax: info.fax,
      email: info.email,
      adresse: info.adresse,
      siteWeb: info.siteWeb,
      valeursTva: info.valeursTva,
      valeursTimbre: info.valeursTimbre,
    };
    res.json(publicInfo);
  } catch (err: unknown) {
    console.error('GET /api/company-info error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des informations' });
  }
});

// GET /api/company-info/admin — Admin : toutes les informations (avec RIB, matricule, etc.)
router.get('/admin', requireAuth, async (_req: Request, res: Response) => {
  try {
    const info = await getOrCreate();
    res.json(info);
  } catch (err: unknown) {
    console.error('GET /api/company-info/admin error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des informations' });
  }
});

// PUT /api/company-info — Admin seulement
router.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      nomSociete,
      logoUrl,
      matriculeFiscale,
      telephone,
      fax,
      email,
      adresse,
      siteWeb,
      banque,
      rib,
      valeursTva,
      valeursTimbre,
      tauxFrais,
      timbreFiscal,
    } = req.body;

    // S'assurer que le singleton existe
    await getOrCreate();

    const updated = await prisma.infoSociete.update({
      where: { id: 1 },
      data: {
        ...(nomSociete !== undefined && { nomSociete: String(nomSociete).trim() || 'RZMedical' }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl?.trim() || null }),
        ...(matriculeFiscale !== undefined && { matriculeFiscale: matriculeFiscale?.trim() || null }),
        ...(telephone !== undefined && { telephone: telephone?.trim() || null }),
        ...(fax !== undefined && { fax: fax?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(adresse !== undefined && { adresse: adresse?.trim() || null }),
        ...(siteWeb !== undefined && { siteWeb: siteWeb?.trim() || null }),
        ...(banque !== undefined && { banque: banque?.trim() || null }),
        ...(rib !== undefined && { rib: rib?.trim() || null }),
        ...(valeursTva !== undefined && {
          valeursTva: Array.isArray(valeursTva)
            ? valeursTva.map((v: unknown) => Number(v)).filter((v: number) => !isNaN(v))
            : [],
        }),
        ...(valeursTimbre !== undefined && {
          valeursTimbre: Array.isArray(valeursTimbre)
            ? valeursTimbre.map((v: unknown) => Number(v)).filter((v: number) => !isNaN(v) && v >= 0)
            : [],
        }),
        ...(tauxFrais !== undefined && { tauxFrais: tauxFrais !== null && tauxFrais !== '' ? Number(tauxFrais) : null }),
        ...(timbreFiscal !== undefined && { timbreFiscal: timbreFiscal !== null && timbreFiscal !== '' ? Number(timbreFiscal) : null }),
      },
    });

    res.json(updated);
  } catch (err: unknown) {
    console.error('PUT /api/company-info error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

export default router;
