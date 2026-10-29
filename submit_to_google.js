#!/usr/bin/env node
/**
 * submit_to_google.js
 * ════════════════════════════════════════════════════════════════════════════
 * Soumet toutes les URLs produit de randzmedical.com à l'API Google Indexing.
 *
 * PRÉREQUIS :
 * 1. Activer l'API Google Indexing dans Google Cloud Console
 * 2. Créer un compte de service et télécharger le fichier JSON de clé
 * 3. Ajouter ce compte de service comme propriétaire dans Google Search Console
 * 4. Placer le fichier JSON ici sous le nom : google-service-account.json
 * 5. Exécuter : node submit_to_google.js
 *
 * LIMITES :
 * - Quota gratuit : 200 URLs / jour via l'API Indexing
 * - Le script soumet par lots de 200 URLs et attend si la limite est atteinte
 * ════════════════════════════════════════════════════════════════════════════
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Configuration ────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "google-service-account.json");
const URLS_FILE = path.join(__dirname, "produits_urls.txt");
const DONE_FILE = path.join(__dirname, "submit_done.txt");
const LOG_FILE = path.join(__dirname, "submit_log.txt");

const BATCH_SIZE = 200;        // Max 200 / jour gratuit
const DELAY_BETWEEN_MS = 500;  // 500ms entre chaque requête

// ── Helpers ──────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Obtenir un token OAuth2 depuis le compte de service Google ───────────────
async function getAccessToken(serviceAccount) {
  // Créer un JWT signé avec la clé privée du compte de service
  const { createSign } = require("crypto");

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");

  const unsignedToken = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsignedToken);
  const signature = sign.sign(serviceAccount.private_key, "base64url");
  const jwt = `${unsignedToken}.${signature}`;

  // Échanger le JWT contre un access token
  return new Promise((resolve, reject) => {
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req = https.request({
      hostname: "oauth2.googleapis.com",
      path: "/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) resolve(parsed.access_token);
          else reject(new Error("Token OAuth échoué : " + data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Soumettre une URL à l'API Google Indexing ────────────────────────────────
async function submitUrl(url, accessToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ url, type: "URL_UPDATED" });
    const req = https.request({
      hostname: "indexing.googleapis.com",
      path: "/v3/urlNotifications:publish",
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Programme principal ──────────────────────────────────────────────────────
async function main() {
  // Vérifier les fichiers requis
  if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    console.error(`\n❌ ERREUR : Fichier introuvable : ${SERVICE_ACCOUNT_FILE}`);
    console.error("\nSuivez les étapes dans le GUIDE_INDEXATION_GOOGLE.md pour le créer.\n");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, "utf-8"));
  const allUrls = fs.readFileSync(URLS_FILE, "utf-8").trim().split("\n").filter(u => u.trim());

  // Charger les URLs déjà soumises pour reprendre là où on s'est arrêté
  const doneSet = new Set(
    fs.existsSync(DONE_FILE)
      ? fs.readFileSync(DONE_FILE, "utf-8").trim().split("\n").filter(Boolean)
      : []
  );

  const pending = allUrls.filter(u => !doneSet.has(u.trim()));

  log(`📋 Total URLs : ${allUrls.length}`);
  log(`✅ Déjà soumises : ${doneSet.size}`);
  log(`⏳ Restantes à soumettre : ${pending.length}`);

  if (pending.length === 0) {
    log("🎉 Toutes les URLs ont déjà été soumises !");
    return;
  }

  // Soumettre par lots de BATCH_SIZE
  const batch = pending.slice(0, BATCH_SIZE);
  log(`\n🚀 Soumission du lot de ${batch.length} URLs (limite API : ${BATCH_SIZE}/jour)...`);

  // Obtenir un token OAuth2
  log("🔑 Obtention du token OAuth2...");
  let accessToken;
  try {
    accessToken = await getAccessToken(serviceAccount);
    log("✅ Token obtenu !");
  } catch (e) {
    log("❌ Erreur token OAuth : " + e.message);
    process.exit(1);
  }

  // Soumettre chaque URL
  let success = 0;
  let errors = 0;

  for (let i = 0; i < batch.length; i++) {
    const url = batch[i].trim();
    try {
      const result = await submitUrl(url, accessToken);
      if (result.status === 200) {
        success++;
        fs.appendFileSync(DONE_FILE, url + "\n");
        if ((i + 1) % 10 === 0) {
          log(`  ✅ ${i + 1}/${batch.length} soumises...`);
        }
      } else {
        errors++;
        log(`  ⚠️  [${result.status}] ${url} → ${result.body}`);
      }
    } catch (e) {
      errors++;
      log(`  ❌ Erreur ${url} : ${e.message}`);
    }
    await sleep(DELAY_BETWEEN_MS);
  }

  log(`\n════════════════════════════════════════`);
  log(`✅ Soumises avec succès : ${success}`);
  log(`❌ Erreurs : ${errors}`);
  log(`📦 Restantes pour demain : ${pending.length - batch.length}`);
  log(`════════════════════════════════════════`);

  if (pending.length - batch.length > 0) {
    log(`\n⏰ Relancez le script demain pour soumettre les ${pending.length - batch.length} URLs restantes.`);
    log(`   Le script reprend automatiquement là où il s'est arrêté.`);
  } else {
    log(`\n🎉 Toutes les URLs ont été soumises à Google !`);
  }
}

main().catch(e => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});
