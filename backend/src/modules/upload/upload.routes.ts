import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { requireAuth } from '../auth/auth.middleware';

// Configure upload directory
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '200', 10);

const uploadPath = path.isAbsolute(uploadDir)
  ? uploadDir
  : path.join(process.cwd(), uploadDir);

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

// We use memory storage to intercept the image and apply a watermark
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: maxFileSizeMB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Seules les images, PDF et documents Office sont acceptés.'));
    }
  }
});

const router = Router();

// Save a file as-is (no watermark) — used for logos, PDFs, banners, profile photos, etc.
async function saveFileAsIs(file: Express.Multer.File): Promise<string> {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(file.originalname) || '.bin';
  const filename = file.fieldname + '-' + uniqueSuffix + ext;
  const filePath = path.join(uploadPath, filename);
  await fs.promises.writeFile(filePath, file.buffer);
  return `/uploads/${filename}`;
}

// Save a product image with the site watermark "https://randzmedical.com/"
async function saveProductImageWithWatermark(file: Express.Multer.File): Promise<string> {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(file.originalname) || '.png';
  const filename = file.fieldname + '-' + uniqueSuffix + ext;
  const filePath = path.join(uploadPath, filename);

  const isImage = file.mimetype.startsWith('image/');

  if (isImage && file.mimetype !== 'image/svg+xml') {
    try {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();

      const width = metadata.width || 800;
      const height = metadata.height || 600;

      // Font size ≈ 4% of image width, minimum 14px
      const fontSize = Math.max(14, Math.round(width * 0.04));

      // SVG watermark overlay — gris semi-transparent, centré
      const svgOverlay = `
        <svg width="${width}" height="${height}">
          <style>
            .wm { fill: rgba(128, 128, 128, 0.7); font-size: ${fontSize}px; font-weight: bold; font-family: "DejaVu Sans", sans-serif; }
          </style>
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="wm">https://randzmedical.com/</text>
        </svg>
      `;

      await image
        .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
        .toFile(filePath);
    } catch (err) {
      console.error("Erreur lors de l'application du watermark produit :", err);
      // Fallback : sauvegarder l'image originale sans filigrane
      await fs.promises.writeFile(filePath, file.buffer);
    }
  } else {
    // SVGs et autres formats non supportés par sharp : sauvegarder tel quel
    await fs.promises.writeFile(filePath, file.buffer);
  }

  return `/uploads/${filename}`;
}

// Route pour un seul fichier (logo, PDF, bannière, photo de profil…) — SANS filigrane
// Protégée : seuls les admins authentifiés peuvent uploader
router.post('/single', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier uploadé' });
  }

  try {
    const url = await saveFileAsIs(req.file);
    res.json({ url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du traitement du fichier' });
  }
});

// Route pour plusieurs fichiers — images de produit UNIQUEMENT, avec filigrane randzmedical.com
// Protégée : seuls les admins authentifiés peuvent uploader
router.post('/multiple', requireAuth, upload.array('files', 10), async (req: Request, res: Response) => {
  if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
    return res.status(400).json({ error: 'Aucun fichier uploadé' });
  }

  try {
    const files = req.files as Express.Multer.File[];
    const urls = await Promise.all(files.map(file => saveProductImageWithWatermark(file)));
    res.json({ urls });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du traitement des fichiers' });
  }
});

export default router;

