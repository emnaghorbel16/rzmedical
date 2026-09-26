import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import prisma from '../../config/prisma';

const TEAL  = '#539dba';
const RED   = '#dc2626';
const BLACK = '#111827';
const GRAY  = '#374151';
const WHITE = '#ffffff';
const LIGHT = '#f0f9ff';

function logoPath(logoUrl: string | null) {
  const candidates = [
    logoUrl && path.resolve(process.cwd(), logoUrl.replace(/^\//, '')),
    path.resolve(process.cwd(), 'assets/logo-rzmedical.png'),
    path.resolve(process.cwd(), '../web/public/images/logo/logo-rzmedical.png'),
    path.resolve('E:/rzmedical/backend/assets/logo-rzmedical.png'),
  ].filter(Boolean) as string[];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

function formatNum(n: number): string {
  return n.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export async function generateBonSortiePdf(id: number): Promise<Buffer> {
  const bon = await prisma.bonSortie.findUnique({
    where: { id },
    include: {
      commercial: {
        select: {
          nom: true,
          prenom: true,
          email: true,
          telephone: true,
          cin: true,
          matriculeFiscale: true,
          matriculeVoiture: true,
        },
      },
      lignes: {
        include: {
          produit: {
            select: {
              nom: true,
              reference: true,
              prix: true,
            },
          },
        },
      },
    },
  });
  if (!bon) throw new Error('Bon de sortie introuvable');

  const company = await prisma.infoSociete.findUnique({ where: { id: 1 } }).catch(() => null);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 15, bottom: 20, left: 15, right: 15 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Logo ──────────────────────────────────────────────────────────────────
    const logo = logoPath(company?.logoUrl ?? null);
    if (logo) {
      try { doc.image(logo, 20, 16, { fit: [75, 85] }); } catch { /* optional */ }
    }

    // ── En-tête société ───────────────────────────────────────────────────────
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(14)
      .text(company?.nomSociete || 'R and Z Medical', 16, 105);
    doc.font('Helvetica').fontSize(8.5).fillColor(GRAY)
      .text(company?.adresse || '', 16, 122, { width: 250 })
      .text(`Tél : ${company?.telephone || '—'}  |  Email : ${company?.email || '—'}`, 16, 148)
      .text(`MF : ${(company as any)?.matriculeFiscale || '—'}`, 16, 162);

    // ── Bandeau rouge "VALABLE SUR TOUT LA TUNISIE" ───────────────────────────
    doc.rect(15, 180, 565, 18).fillColor(RED).fill();
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(10)
      .text('✦  VALABLE SUR TOUT LA TUNISIE  ✦', 15, 184, { width: 565, align: 'center' });

    // ── Titre BON DE SORTIE ───────────────────────────────────────────────────
    doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(15).text('BON DE SORTIE', 16, 207);
    doc.fillColor(BLACK).fontSize(12).text(`N° ${bon.code}`, 16, 225);
    if (bon.commentaire)
      doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`Observation : ${bon.commentaire}`, 16, 242, { width: 255 });

    // ── Encart infos bon (droite) ─────────────────────────────────────────────
    const boxX = 293, boxW = 287, headerH = 20;
    doc.rect(boxX, 16, boxW, 100).lineWidth(0.75).strokeColor(TEAL).stroke();
    doc.rect(boxX, 16, boxW, headerH).fillColor(TEAL).fill();
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9.5)
      .text('Informations du bon', boxX, 21, { width: boxW, align: 'center' });
    doc.fillColor(BLACK).font('Helvetica').fontSize(9)
      .text(`N° Bon : ${bon.code}`,        boxX + 10, 44)
      .text(`Date : ${new Date(bon.creeLe).toLocaleDateString('fr-FR')}`, boxX + 10, 60)
      .text(`Statut : ${bon.statut}`,       boxX + 10, 76)
      .text(`Validé le : ${bon.valideLe ? new Date(bon.valideLe).toLocaleDateString('fr-FR') : '—'}`, boxX + 10, 92);

    // ── Encart commercial ─────────────────────────────────────────────────────
    const com = bon.commercial;
    doc.rect(boxX, 125, boxW, 130).lineWidth(0.75).strokeColor(TEAL).stroke();
    doc.rect(boxX, 125, boxW, headerH).fillColor(TEAL).fill();
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9.5)
      .text('Commercial destinataire', boxX, 130, { width: boxW, align: 'center' });

    let cy = 153;
    const comLine = (label: string, val: string | null | undefined) => {
      doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8.5).text(`${label} : `, boxX + 10, cy, { continued: true, width: 90 });
      doc.fillColor(BLACK).font('Helvetica').fontSize(8.5).text(val || '—', { width: boxW - 20 });
      cy += 16;
    };

    comLine('Nom & Prénom', `${com.prenom || ''} ${com.nom || ''}`.trim());
    comLine('CIN',           com.cin);
    comLine('MF',            com.matriculeFiscale);
    comLine('Mat. voiture',  com.matriculeVoiture);
    comLine('Téléphone',     com.telephone);

    // ── Tableau des lignes ────────────────────────────────────────────────────
    const tableTop = 265;
    const columns = [
      { label: 'Référence',   x: 15,  width: 95,  align: 'left'  },
      { label: 'Désignation', x: 110, width: 205, align: 'left'  },
      { label: 'Qté',         x: 315, width: 55,  align: 'right' },
      { label: 'P.U. HT',    x: 370, width: 95,  align: 'right' },
      { label: 'Total HT',   x: 465, width: 115, align: 'right' },
    ];

    doc.rect(15, tableTop, 565, headerH).fillColor(TEAL).fill();
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9);
    columns.forEach((col) =>
      doc.text(col.label, col.x + 4, tableTop + 5, { width: col.width - 8, align: col.align as any })
    );

    let y = tableTop + headerH;
    let grandTotal = 0;
    let rowIndex = 0;

    for (const ligne of bon.lignes) {
      const pu    = Number(ligne.produit.prix ?? 0);
      const total = pu * ligne.quantite;
      grandTotal += total;

      // Zebra rows
      if (rowIndex % 2 === 0) {
        doc.rect(15, y, 565, 20).fillColor(LIGHT).fill();
      }
      rowIndex++;

      doc.fillColor(BLACK).font('Helvetica').fontSize(8.5);
      doc.text(ligne.produit.reference || '—', columns[0].x + 4, y + 5, { width: columns[0].width - 8, lineBreak: false });
      doc.text(ligne.produit.nom,              columns[1].x + 4, y + 5, { width: columns[1].width - 8, lineBreak: false });
      doc.text(String(ligne.quantite),         columns[2].x + 4, y + 5, { width: columns[2].width - 8, align: 'right', lineBreak: false });
      doc.text(`${formatNum(pu)} TND`,         columns[3].x + 4, y + 5, { width: columns[3].width - 8, align: 'right', lineBreak: false });
      doc.text(`${formatNum(total)} TND`,      columns[4].x + 4, y + 5, { width: columns[4].width - 8, align: 'right', lineBreak: false });
      y += 20;
    }

    const tableBottom = Math.max(y, 430);
    doc.rect(15, tableTop, 565, tableBottom - tableTop).lineWidth(0.75).strokeColor(TEAL).stroke();

    // Ligne verticale de séparation des colonnes
    [110, 315, 370, 465].forEach((cx) => {
      doc.moveTo(cx, tableTop).lineTo(cx, tableBottom).lineWidth(0.5).strokeColor(TEAL).stroke();
    });

    // ── Total général ─────────────────────────────────────────────────────────
    const totalY = tableBottom + 10;
    doc.rect(365, totalY, 215, 22).fillColor(TEAL).fill();
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(10)
      .text(`TOTAL HT : ${formatNum(grandTotal)} TND`, 365, totalY + 5, { width: 215, align: 'center' });

    const nbArticles = bon.lignes.reduce((s, l) => s + l.quantite, 0);
    doc.font('Helvetica').fontSize(8.5).fillColor(GRAY)
      .text(`Nombre total d'articles : ${nbArticles}`, 15, totalY + 5, { width: 340 });

    // ── Signature responsable uniquement ──────────────────────────────────────
    const sigY = totalY + 50;
    doc.font('Helvetica').fontSize(8.5).fillColor(GRAY)
      .text('Bon de sortie : dépôt → commercial', 15, sigY);
    doc.font('Helvetica').fontSize(9).fillColor(BLACK)
      .text('Signature du responsable', 50, sigY + 30);
    doc.rect(30, sigY + 12, 180, 50).strokeColor('#9ca3af').lineWidth(0.5).stroke();

    doc.end();
  });
}
