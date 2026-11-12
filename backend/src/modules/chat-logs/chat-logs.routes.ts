import { Router, Request, Response } from 'express';
import prisma from '../../config/prisma';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// POST /api/chat-logs/save — Appelé par web/api/chat pour sauvegarder une conversation
// Protégé par secret interne (pas d'auth JWT requise)
router.post('/save', async (req: Request, res: Response) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_SECRET) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  try {
    const { sessionId, clientId, ipAddress, userAgent, messages } = req.body as {
      sessionId: string;
      clientId?: number;
      ipAddress?: string;
      userAgent?: string;
      messages: { role: string; content: string }[];
    };

    if (!sessionId || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'sessionId et messages requis' });
    }

    // Upsert conversation (crée ou met à jour selon sessionId)
    const conversation = await prisma.chatConversation.upsert({
      where: { sessionId },
      create: {
        sessionId,
        clientId: clientId ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        nbMessages: messages.length,
      },
      update: {
        nbMessages: messages.length,
        misAJourLe: new Date(),
        ...(clientId && { clientId }),
      },
    });

    // Supprimer les anciens messages et réinsérer (pour garder la cohérence)
    await prisma.chatMessage.deleteMany({ where: { conversationId: conversation.id } });
    await prisma.chatMessage.createMany({
      data: messages.map((m) => ({
        conversationId: conversation.id,
        role: m.role,
        content: m.content,
      })),
    });

    res.json({ ok: true, conversationId: conversation.id });
  } catch (err) {
    console.error('POST /api/chat-logs/save error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/chat-logs — Liste toutes les conversations (admin)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      prisma.chatConversation.findMany({
        skip,
        take: limit,
        orderBy: { misAJourLe: 'desc' },
        include: {
          client: {
            select: { id: true, prenom: true, nom: true, email: true },
          },
          messages: {
            orderBy: { creeLe: 'asc' },
            take: 1, // Premier message uniquement pour aperçu
          },
        },
      }),
      prisma.chatConversation.count(),
    ]);

    res.json({
      conversations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('GET /api/chat-logs error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/chat-logs/:id — Détail d'une conversation avec tous ses messages
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, prenom: true, nom: true, email: true, telephone: true },
        },
        messages: { orderBy: { creeLe: 'asc' } },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    res.json(conversation);
  } catch (err) {
    console.error('GET /api/chat-logs/:id error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/chat-logs/:id — Supprimer une conversation
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await prisma.chatConversation.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/chat-logs/:id error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
