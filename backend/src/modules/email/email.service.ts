/**
 * Service Email — Envoi des emails transactionnels et promotionnels.
 * Utilise la configuration SMTP définie dans les variables d'environnement.
 */

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM = `"${process.env.EMAIL_FROM_NAME || 'Randz Medical'}" <${process.env.EMAIL_USER}>`;
const SITE_URL = process.env.FRONTEND_URL || 'https://randzmedical.com';

/**
 * Envoie un email de promotion à une liste de destinataires.
 * L'envoi est fait en BCC (copie cachée) pour protéger la vie privée des clients.
 */
export async function sendPromoEmail(opts: {
  to: string[];           // liste d'emails clients
  productName: string;
  productReference: string;
  productDescription: string | null;
  originalPrice: number;
  discountPercent: number;
  imageUrl?: string | null;
}): Promise<void> {
  if (!opts.to.length) return;

  const { productName, productReference, productDescription, originalPrice, discountPercent, imageUrl } = opts;
  const discountedPrice = originalPrice * (1 - discountPercent / 100);
  const productUrl = `${SITE_URL}/produit/${encodeURIComponent(productReference)}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Offre Spéciale — ${productName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0c2340 0%,#1a4a7a 100%);padding:30px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:1px;">
                🎉 Offre Spéciale Randz Medical
              </h1>
              <p style="margin:8px 0 0;color:#a8c6e8;font-size:14px;">
                randzmedical.com — Matériel Médico-Dentaire
              </p>
            </td>
          </tr>

          <!-- BADGE PROMO -->
          <tr>
            <td style="background:#e8f4fd;padding:16px 40px;text-align:center;">
              <span style="display:inline-block;background:#e74c3c;color:#fff;font-size:22px;font-weight:800;padding:10px 28px;border-radius:50px;letter-spacing:1px;">
                −${discountPercent}% de remise
              </span>
            </td>
          </tr>

          <!-- IMAGE PRODUIT -->
          ${imageUrl ? `
          <tr>
            <td style="padding:24px 40px 0;text-align:center;">
              <img src="${imageUrl}" alt="${productName}" style="max-width:280px;max-height:220px;object-fit:contain;border-radius:8px;border:1px solid #e0e0e0;" />
            </td>
          </tr>` : ''}

          <!-- PRODUIT INFO -->
          <tr>
            <td style="padding:24px 40px;">
              <h2 style="margin:0 0 8px;color:#0c2340;font-size:20px;">${productName}</h2>
              <p style="margin:0 0 16px;color:#666;font-size:13px;">Réf : ${productReference}</p>
              ${productDescription ? `<p style="margin:0 0 20px;color:#444;font-size:14px;line-height:1.6;">${productDescription}</p>` : ''}

              <!-- PRIX -->
              <table cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:8px;padding:16px 20px;margin-bottom:24px;width:100%;box-sizing:border-box;">
                <tr>
                  <td style="color:#888;font-size:14px;">Prix normal</td>
                  <td align="right" style="color:#888;font-size:14px;text-decoration:line-through;">${originalPrice.toFixed(2)} TND</td>
                </tr>
                <tr>
                  <td style="color:#e74c3c;font-size:18px;font-weight:700;padding-top:8px;">Prix promotionnel</td>
                  <td align="right" style="color:#e74c3c;font-size:22px;font-weight:800;padding-top:8px;">${discountedPrice.toFixed(2)} TND</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:8px;color:#27ae60;font-size:13px;font-weight:600;">
                    ✅ Vous économisez ${(originalPrice - discountedPrice).toFixed(2)} TND !
                  </td>
                </tr>
              </table>

              <!-- CTA BUTTON -->
              <div style="text-align:center;">
                <a href="${productUrl}" style="display:inline-block;background:linear-gradient(135deg,#0c2340,#1a4a7a);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.5px;">
                  Voir le produit →
                </a>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f4f6f9;padding:20px 40px;text-align:center;border-top:1px solid #e0e0e0;">
              <p style="margin:0 0 8px;color:#888;font-size:12px;">
                Vous recevez cet email car vous êtes client de <a href="${SITE_URL}" style="color:#1a4a7a;">Randz Medical</a>.
              </p>
              <p style="margin:0;color:#aaa;font-size:11px;">
                ${SITE_URL} — Tunisie
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Envoi en lots de 50 (limite BCC Gmail)
  const BATCH_SIZE = 50;
  for (let i = 0; i < opts.to.length; i += BATCH_SIZE) {
    const batch = opts.to.slice(i, i + BATCH_SIZE);
    await transporter.sendMail({
      from: FROM,
      to: process.env.EMAIL_USER, // destinataire visible = soi-même
      bcc: batch,                  // clients en copie cachée
      subject: `🎉 Offre spéciale −${discountPercent}% sur ${productName}`,
      html,
    });
  }

  console.log(`[Email] Promo envoyée à ${opts.to.length} client(s) pour : ${productName}`);
}
