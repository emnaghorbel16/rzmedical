import { Router, Request, Response } from 'express';
import prisma from '../../config/prisma';
import { requireAuth } from '../auth/auth.middleware';
import nodemailer from 'nodemailer';

const router = Router();

const SEUIL_ALERTE_ELEVE = 70;
const SEUIL_ALERTE_CRITIQUE = 90;
const LIMITE_TOKENS_PAR_MINUTE = 6000;

let derniereAlerteEnvoyee: Date | null = null;

async function envoyerAlerteEmail(pourcentage: number, tokensTotal: number, tokensRestants: number) {
  if (derniereAlerteEnvoyee && (Date.now() - derniereAlerteEnvoyee.getTime()) < 30 * 60 * 1000) return;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const adminEmail = process.env.ADMIN_EMAIL || smtpUser;
  if (!smtpHost || !smtpUser || !smtpPass || !adminEmail) {
    console.warn('[GroqAlert] Variables SMTP non configurees, alerte email ignoree.');
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });
    const niveau = pourcentage >= SEUIL_ALERTE_CRITIQUE ? 'CRITIQUE' : 'ELEVEE';
    const couleur = pourcentage >= SEUIL_ALERTE_CRITIQUE ? '#dc2626' : '#ea580c';
    await transporter.sendMail({
      from: `"RZMedical System" <${smtpUser}>`,
      to: adminEmail,
      subject: `[RZMedical] Alerte ${niveau} - Consommation Groq API : ${pourcentage}%`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:${couleur};color:white;padding:20px;border-radius:8px 8px 0 0"><h2 style="margin:0">Alerte ${niveau} - Consommation Groq API</h2></div><div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px"><p>La consommation Groq a atteint <strong>${pourcentage}%</strong>.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:12px;font-weight:bold">Utilisation</td><td style="padding:12px;color:${couleur};font-size:24px;font-weight:bold">${pourcentage}%</td></tr><tr><td style="padding:12px;font-weight:bold">Tokens utilises</td><td style="padding:12px">${tokensTotal.toLocaleString('fr-FR')}</td></tr><tr><td style="padding:12px;font-weight:bold">Tokens restants</td><td style="padding:12px">${tokensRestants.toLocaleString('fr-FR')}</td></tr><tr><td style="padding:12px;font-weight:bold">Heure</td><td style="padding:12px">${new Date().toLocaleString('fr-FR')}</td></tr></table></div></div>`,
    });
    derniereAlerteEnvoyee = new Date();
    console.log(`[GroqAlert] Alerte email envoyee - ${pourcentage}%`);
  } catch (err) {
    console.error('[GroqAlert] Echec envoi email:', err);
  }
}

router.post('/record', async (req: Request, res: Response) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_SECRET) {
    return res.status(403).json({ error: 'Acces refuse' });
  }
  try {
    const { modele, tokensPrompt, tokensCompletion, tokensTotal, tokensRestants, requetesRestantes } = req.body;
    if (typeof tokensTotal !== 'number' || !modele) {
      return res.status(400).json({ error: 'Donnees invalides' });
    }
    await prisma.groqUsage.create({
      data: {
        modele,
        tokensPrompt: tokensPrompt ?? 0,
        tokensCompletion: tokensCompletion ?? 0,
        tokensTotal,
        tokensRestants: tokensRestants ?? null,
        requetesRestantes: requetesRestantes ?? null,
      },
    });
    if (tokensRestants != null) {
      const limite = tokensTotal + tokensRestants;
      const pourcentage = limite > 0 ? Math.round((tokensTotal / limite) * 100) : 0;
      if (pourcentage >= SEUIL_ALERTE_ELEVE) {
        envoyerAlerteEmail(pourcentage, tokensTotal, tokensRestants).catch(console.error);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/groq-stats/record error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [dernierRecord, totaux, parModele, historiqueRaw] = await Promise.all([
      prisma.groqUsage.findFirst({ orderBy: { creeLe: 'desc' } }),
      prisma.groqUsage.aggregate({
        _sum: { tokensTotal: true, tokensPrompt: true, tokensCompletion: true },
        _count: { id: true },
      }),
      prisma.groqUsage.groupBy({
        by: ['modele'],
        _sum: { tokensTotal: true },
        _count: { id: true },
        orderBy: { _sum: { tokensTotal: 'desc' } },
      }),
      prisma.$queryRaw<Array<{ heure: Date; tokens: bigint; requetes: bigint }>>`
        SELECT
          date_trunc('hour', "creeLe") AS heure,
          SUM("tokensTotal")::bigint   AS tokens,
          COUNT(*)::bigint             AS requetes
        FROM groq_usage
        WHERE "creeLe" >= NOW() - INTERVAL '24 hours'
        GROUP BY 1
        ORDER BY 1
      `,
    ]);
    const tokensRestants = dernierRecord?.tokensRestants ?? null;
    const tokensUtilisesTotal = Number(totaux._sum.tokensTotal ?? 0);
    let pourcentage: number | null = null;
    if (tokensRestants !== null) {
      const limite = tokensUtilisesTotal + tokensRestants;
      pourcentage = limite > 0 ? Math.round((tokensUtilisesTotal / limite) * 100) : 0;
    }
    let indicateur: 'normal' | 'eleve' | 'critique' = 'normal';
    if (pourcentage !== null) {
      if (pourcentage >= SEUIL_ALERTE_CRITIQUE) indicateur = 'critique';
      else if (pourcentage >= SEUIL_ALERTE_ELEVE) indicateur = 'eleve';
    }
    res.json({
      resume: {
        tokensUtilisesTotal,
        tokensPromptTotal: Number(totaux._sum.tokensPrompt ?? 0),
        tokensCompletionTotal: Number(totaux._sum.tokensCompletion ?? 0),
        totalRequetes: totaux._count.id,
        tokensRestants,
        pourcentage,
        indicateur,
        modele: dernierRecord?.modele ?? null,
        derniereMiseAJour: dernierRecord?.creeLe ?? null,
        seuilEleve: SEUIL_ALERTE_ELEVE,
        seuilCritique: SEUIL_ALERTE_CRITIQUE,
      },
      parModele: parModele.map((m) => ({
        modele: m.modele,
        tokensTotal: Number(m._sum.tokensTotal ?? 0),
        requetes: m._count.id,
      })),
      historique: historiqueRaw.map((h) => ({
        heure: h.heure,
        tokens: Number(h.tokens),
        requetes: Number(h.requetes),
      })),
    });
  } catch (err) {
    console.error('GET /api/groq-stats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/reset', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { count } = await prisma.groqUsage.deleteMany();
    derniereAlerteEnvoyee = null;
    res.json({ ok: true, supprime: count });
  } catch (err) {
    console.error('DELETE /api/groq-stats/reset error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
