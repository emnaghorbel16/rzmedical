/**
 * Script d'import des marques dentaires depuis brands_rzmedical.json
 *
 * Usage :
 *   npx tsx scripts/import/import-brands.ts             ← import réel
 *   npx tsx scripts/import/import-brands.ts --dry-run   ← simulation
 *
 * À exécuter DANS le container backend :
 *   docker exec -it rzmedical_backend_prod npx tsx scripts/import/import-brands.ts --dry-run
 */

import { PrismaClient } from '../../generated/prisma';
import fs from 'fs';
import path from 'path';

// ─── Configuration ────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const BRANDS_JSON = path.join(__dirname, 'brands_rzmedical.json');
const LOGOS_DIR = path.join(__dirname, 'brands');
const UPLOADS_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
const CATEGORIE_NOM = 'Dentaire';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandEntry {
  nom: string;
  logo: string;
  categorieParente: string;
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function slugify(nom: string): string {
  return nom
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  RZMedical — Import Marques Dentaires');
  console.log(`  Mode : ${DRY_RUN ? '🔍 DRY-RUN (simulation, aucune écriture)' : '🚀 IMPORT RÉEL'}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── 1. Vérification connexion PostgreSQL ────────────────────────────────────
  log('🔌 Vérification connexion PostgreSQL...');
  try {
    await prisma.$queryRaw`SELECT 1`;
    log('✅ Connexion PostgreSQL OK');
  } catch (err: any) {
    log(`❌ ERREUR connexion PostgreSQL : ${err.message}`);
    process.exit(1);
  }

  // ── 2. Vérification dossier uploads ────────────────────────────────────────
  log(`📁 Dossier uploads : ${UPLOADS_DIR}`);
  if (!fs.existsSync(UPLOADS_DIR)) {
    if (!DRY_RUN) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      log('📁 Dossier uploads créé');
    } else {
      log("⚠️  [DRY-RUN] Dossier uploads absent — sera créé lors de l'import réel");
    }
  } else {
    log('✅ Dossier uploads OK');
  }

  // ── 3. Lecture du fichier JSON ──────────────────────────────────────────────
  log(`📄 Lecture de ${BRANDS_JSON}`);
  if (!fs.existsSync(BRANDS_JSON)) {
    log(`❌ Fichier introuvable : ${BRANDS_JSON}`);
    log('   Placez brands_rzmedical.json dans backend/scripts/import/');
    process.exit(1);
  }
  const raw = fs.readFileSync(BRANDS_JSON, 'utf-8');
  const brands: BrandEntry[] = JSON.parse(raw);
  log(`✅ ${brands.length} marques trouvées dans le fichier JSON`);

  // ── 4. Récupération catégorie "Dentaire" ────────────────────────────────────
  log(`🔎 Recherche de la catégorie "${CATEGORIE_NOM}" en base...`);
  const categorie = await prisma.categorie.findUnique({
    where: { nom: CATEGORIE_NOM },
  });

  if (!categorie) {
    log(`❌ Catégorie "${CATEGORIE_NOM}" introuvable en base.`);
    const allCats = await prisma.categorie.findMany({ select: { id: true, nom: true } });
    log('   Catégories disponibles :');
    allCats.forEach(c => log(`     - id=${c.id}  nom="${c.nom}"`));
    process.exit(1);
  }

  log(`✅ Catégorie trouvée : id=${categorie.id}  nom="${categorie.nom}"`);
  const categorieId = categorie.id;

  // ── 5. Marques existantes en base ──────────────────────────────────────────
  const existantes = await prisma.marque.findMany({
    where: { categorieId },
    select: { nom: true },
  });
  const existantesSet = new Set(existantes.map(m => m.nom.toLowerCase().trim()));
  log(`📊 Marques existantes pour "${CATEGORIE_NOM}" : ${existantes.length}`);

  // ── 6. Vérification dossier logos ──────────────────────────────────────────
  log(`🖼️  Dossier logos : ${LOGOS_DIR}`);
  if (!fs.existsSync(LOGOS_DIR)) {
    log("⚠️  Dossier brands/ absent — les marques seront créées sans logo");
  }

  // ── 7. Import ───────────────────────────────────────────────────────────────
  console.log('');
  log('─────────────────────────────────────────────────');
  log("  Début de l'import...");
  log('─────────────────────────────────────────────────');

  let countTotal = brands.length;
  let countExistante = 0;
  let countCreee = 0;
  let countSansLogo = 0;
  let countErreur = 0;

  for (const entry of brands) {
    const nom = entry.nom.trim();
    const nomLower = nom.toLowerCase();

    // Vérification doublon
    if (existantesSet.has(nomLower)) {
      log(`  ⏭️  SKIP (déjà existante) : ${nom}`);
      countExistante++;
      continue;
    }

    // Gestion du logo
    let logoDbPath: string | undefined = undefined;

    if (entry.logo) {
      // "brands/AARC_DENTAL/logo.jpg" → on retire le préfixe "brands/"
      const logoRelative = entry.logo.replace(/^brands\//, '');
      const logoSrc = path.join(LOGOS_DIR, logoRelative);

      if (fs.existsSync(logoSrc)) {
        const ext = path.extname(logoSrc);
        const destFilename = `brand-${slugify(nom)}-logo${ext}`;
        const destPath = path.join(UPLOADS_DIR, destFilename);
        logoDbPath = `/uploads/${destFilename}`;

        if (!DRY_RUN) {
          try {
            fs.copyFileSync(logoSrc, destPath);
          } catch (err: any) {
            log(`  ⚠️  Erreur copie logo "${nom}" : ${err.message}`);
            logoDbPath = undefined;
            countSansLogo++;
          }
        } else {
          log(`  🖼️  [DRY-RUN] Logo : ${logoSrc} → ${destPath}`);
        }
      } else {
        log(`  ⚠️  Logo introuvable : ${logoSrc}`);
        countSansLogo++;
      }
    } else {
      countSansLogo++;
    }

    // Création en base
    if (!DRY_RUN) {
      try {
        await prisma.marque.create({
          data: {
            nom,
            categorieId,
            ...(logoDbPath ? { logo: logoDbPath } : {}),
          },
        });
        log(`  ✅ CRÉÉE : ${nom}${logoDbPath ? ` (logo: ${logoDbPath})` : ' (sans logo)'}`);
        countCreee++;
        existantesSet.add(nomLower);
      } catch (err: any) {
        if (err.code === 'P2002') {
          log(`  ⏭️  SKIP (doublon DB) : ${nom}`);
          countExistante++;
        } else {
          log(`  ❌ ERREUR création "${nom}" : ${err.message}`);
          countErreur++;
        }
      }
    } else {
      log(`  🔍 [DRY-RUN] SERAIT CRÉÉE : ${nom}${logoDbPath ? ` (logo: ${logoDbPath})` : ' (sans logo)'}`);
      countCreee++;
    }
  }

  // ── 8. Résumé final ─────────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  RÉSUMÉ FINAL');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total marques dans le JSON  : ${countTotal}`);
  console.log(`  Déjà existantes (skippées)  : ${countExistante}`);
  console.log(`  ${DRY_RUN ? 'Seraient créées       ' : 'Créées                '}      : ${countCreee}`);
  console.log(`  Sans logo                   : ${countSansLogo}`);
  console.log(`  Erreurs                     : ${countErreur}`);
  if (DRY_RUN) {
    console.log('');
    console.log("  ⚠️  Mode DRY-RUN : aucune donnée n'a été écrite.");
    console.log('  Relancez sans --dry-run pour effectuer l\'import réel.');
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('❌ Erreur fatale :', err);
  await prisma.$disconnect();
  process.exit(1);
});
