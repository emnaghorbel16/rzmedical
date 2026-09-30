import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

// Configure upload directory
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '200', 10);

const uploadPath = path.isAbsolute(uploadDir)
  ? uploadDir
  : path.join(process.cwd(), uploadDir);

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// We use memory storage to intercept the image and apply a watermark
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: maxFileSizeMB * 1024 * 1024 },
});

const router = Router();

// Function to process and save a file (with watermark if image)
async function processAndSaveFile(file: Express.Multer.File): Promise<string> {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(file.originalname) || '.png'; // default to .png if missing
  const filename = file.fieldname + '-' + uniqueSuffix + ext;
  const filePath = path.join(uploadPath, filename);

  const isImage = file.mimetype.startsWith('image/');
  
  if (isImage && file.mimetype !== 'image/svg+xml') {
    try {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();
      
      const width = metadata.width || 800;
      const height = metadata.height || 600;
      
      // Calculate font size based on image width (approx 4% of width to fit the URL)
      const fontSize = Math.max(14, Math.round(width * 0.04));
      
      // Create SVG overlay for the watermark text "https://randzmedical.com/"
      const svgOverlay = `
        <svg width="${width}" height="${height}">
          <style>
            .title { fill: rgba(128, 128, 128, 0.7); font-size: ${fontSize}px; font-weight: bold; font-family: "DejaVu Sans", sans-serif; }
          </style>
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="title">https://randzmedical.com/</text>
        </svg>
      `;

      await image
        .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
        .toFile(filePath);
    } catch (err) {
      console.error("Erreur lors de l'application du watermark :", err);
      // Fallback: save original without watermark if error
      await fs.promises.writeFile(filePath, file.buffer);
    }
  } else {
    // Save non-images (PDFs, SVGs, etc) as-is
    await fs.promises.writeFile(filePath, file.buffer);
  }

  return `/uploads/${filename}`;
}

// Route pour un seul fichier (ex: logo, PDF)
router.post('/single', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier uploadé' });
  }
  
  try {
    const url = await processAndSaveFile(req.file);
    res.json({ url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du traitement du fichier' });
  }
});

// Route pour plusieurs fichiers (ex: images de produit)
router.post('/multiple', upload.array('files', 10), async (req: Request, res: Response) => {
  if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
    return res.status(400).json({ error: 'Aucun fichier uploadé' });
  }
  
  try {
    const files = req.files as Express.Multer.File[];
    const urls = await Promise.all(files.map(file => processAndSaveFile(file)));
    res.json({ urls });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du traitement des fichiers' });
  }
});

export default router;
