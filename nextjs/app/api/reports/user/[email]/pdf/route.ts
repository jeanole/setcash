// ============================================================================
// GET /api/reports/user/[email]/pdf
// ============================================================================
// Generates a PDF expense report for a single user.
// Self can view own report; admins can view any user's report.
// Port of routes/reporting.js lines 10-431
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { exportLimiter } from '@/lib/ratelimit';
import { verifyAdminRole, verifyProjectMember } from '@/lib/auth-guard';
import { UPLOADS_DIR } from '@/lib/upload';
import { SPENDING_BILL_STATUSES, roundCents } from '@/lib/spending';
import { calculateTotal } from '@/lib/utils';
import { BillStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
// @ts-ignore
import PDFDocument from 'pdfkit';

// Upper bounds so a single request cannot build an unbounded PDF.
const MAX_REPORT_BILLS = 1000;
const MAX_REPORT_VGELD = 1000;
const MAX_IMAGES_PER_BILL = 10;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ email: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Rate limit by user email
    const { success } = await exportLimiter.limit(session.user.email);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const targetEmail = decodeURIComponent(params.email);

    // Auth: self OR admin/owner/superadmin
    const isAdmin =
      session.user.role === 'superadmin' ||
      session.user.currentProjectRole === 'admin' ||
      session.user.currentProjectRole === 'owner';

    if (!isAdmin && session.user.email.toLowerCase() !== targetEmail.toLowerCase()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // SEC-02: when accessing another user's report on the strength of an
    // admin role, re-verify that role against the DB — forces re-auth if the
    // caller was demoted mid-session but is still carrying a stale JWT.
    if (isAdmin && session.user.email.toLowerCase() !== targetEmail.toLowerCase()) {
      const guard = await verifyAdminRole(session.user.email ?? '', projectId);
      if (!guard.authorized) {
        return guard.response!;
      }
    } else {
      // Self path: the JWT's currentProjectId may be stale (e.g. removed
      // member), so confirm current membership against the DB.
      const memberCheck = await verifyProjectMember(session.user.email, projectId);
      if (!memberCheck.authorized) {
        return memberCheck.response!;
      }
    }

    // Query bills and vgeld for target user.
    // This per-user report is a complete record of the user's submissions, so
    // ALL statuses (including drafts) are listed here — but the summary and
    // Saldo count only {confirmed, approved, paid} bills, matching the spending
    // aggregates and getVgeldBalance. One extra row is fetched to detect
    // truncation at MAX_REPORT_BILLS.
    const billWhere = {
      projectId,
      submittedByEmail: { equals: targetEmail, mode: 'insensitive' as const },
    };
    const vgeldWhere = {
      projectId,
      toUser: { equals: targetEmail, mode: 'insensitive' as const },
      // Only count confirmed V-Geld transfers (confirmedBy not null).
      confirmedBy: { not: null },
    };

    const [fetchedBills, fetchedVGeld, spendingAgg, vgeldAgg] = await Promise.all([
      prisma.bill.findMany({
        where: billWhere,
        orderBy: { date: 'asc' },
        take: MAX_REPORT_BILLS + 1,
      }),
      prisma.vgeld.findMany({
        where: vgeldWhere,
        orderBy: { date: 'asc' },
        take: MAX_REPORT_VGELD + 1,
      }),
      // Totals come from the database so they stay correct when the listed
      // rows are truncated.
      prisma.bill.aggregate({
        where: {
          ...billWhere,
          status: { in: SPENDING_BILL_STATUSES as unknown as BillStatus[] },
        },
        _count: { _all: true },
        _sum: { brutto19: true, brutto7: true, brutto0: true },
      }),
      prisma.vgeld.aggregate({
        where: vgeldWhere,
        _sum: { amount: true },
      }),
    ]);

    const billsTruncated = fetchedBills.length > MAX_REPORT_BILLS;
    const vgeldTruncated = fetchedVGeld.length > MAX_REPORT_VGELD;
    const userBills = fetchedBills.slice(0, MAX_REPORT_BILLS);
    const userVGeld = fetchedVGeld.slice(0, MAX_REPORT_VGELD);

    if (userBills.length === 0 && userVGeld.length === 0) {
      return NextResponse.json({ error: 'No data found for this user' }, { status: 404 });
    }

    // User position
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userEmail: { equals: targetEmail, mode: 'insensitive' },
      },
      include: { position: true },
    });
    const userRole = member?.position?.name ?? 'Misc';

    // Project title/subtitle from the Project model
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, subtitle: true },
    });
    const pTitle = project?.name ?? '';
    const pSubtitle = project?.subtitle ?? '';
    const pdfPrefix = pTitle ? pTitle + ' - ' : 'SetCash - ';

    // Bulk-fetch allocations for all user bills
    const billIds = userBills.map((b) => b.id);
    const pdfMotiveAllocs: Record<string, { name: string; percentage: number }[]> = {};
    const pdfCategoryAllocs: Record<string, { name: string; percentage: number }[]> = {};

    if (billIds.length > 0) {
      const motiveAllocs = await prisma.billMotive.findMany({
        where: { billId: { in: billIds } },
        include: { motive: { select: { name: true } } },
      });
      for (const a of motiveAllocs) {
        if (!pdfMotiveAllocs[a.billId]) pdfMotiveAllocs[a.billId] = [];
        pdfMotiveAllocs[a.billId].push({ name: a.motive.name, percentage: Number(a.percentage) });
      }

      const categoryAllocs = await prisma.billCategory.findMany({
        where: { billId: { in: billIds } },
        include: { category: { select: { name: true } } },
      });
      for (const a of categoryAllocs) {
        if (!pdfCategoryAllocs[a.billId]) pdfCategoryAllocs[a.billId] = [];
        pdfCategoryAllocs[a.billId].push({ name: a.category.name, percentage: Number(a.percentage) });
      }
    }

    // Bulk-fetch images for all listed bills (one query instead of one per bill)
    const imagesByBillId = new Map<string, { filePath: string }[]>();
    if (billIds.length > 0) {
      const allImages = await prisma.billImage.findMany({
        where: { billId: { in: billIds } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: { billId: true, filePath: true },
      });
      for (const img of allImages) {
        const list = imagesByBillId.get(img.billId);
        if (list) list.push(img);
        else imagesByBillId.set(img.billId, [img]);
      }
    }

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const pass = new PassThrough();
    doc.pipe(pass);

    // Title
    doc.fontSize(20).font('Helvetica-Bold').text(`${pdfPrefix}Belegubersicht`, { align: 'center' });
    if (pSubtitle) {
      doc.fontSize(12).font('Helvetica').text(pSubtitle, { align: 'center' });
    }
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text(`Benutzer: ${targetEmail} (${userRole})`, { align: 'center' });
    doc.fontSize(10).text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' });
    doc.moveDown(1);

    // V-Geld section
    const totalVGeld = roundCents(Number(vgeldAgg._sum.amount ?? 0));
    doc.fontSize(12).font('Helvetica-Bold').text('V-Geld Zahlungen');
    doc.fontSize(10).font('Helvetica');

    if (userVGeld.length === 0) {
      doc.text('Keine V-Geld Zahlungen vorhanden.');
    } else {
      for (const v of userVGeld) {
        doc.text(
          `${new Date(v.date).toLocaleDateString('de-DE')} - ${Number(v.amount).toFixed(2)} EUR von ${v.fromUser || 'Extern'}`
        );
      }
      if (vgeldTruncated) {
        doc
          .fillColor('gray')
          .text(`Hinweis: Es werden nur die ersten ${MAX_REPORT_VGELD} Zahlungen aufgelistet.`);
        doc.fillColor('black');
      }
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text(`V-Geld Gesamt: ${totalVGeld.toFixed(2)} EUR`);
    }
    doc.moveDown(1);

    // Line separator
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // Bills table
    if (userBills.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Belegubersicht');
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const colX = [50, 75, 125, 190, 250, 295, 340, 385, 430, 475, 515];

      doc.font('Helvetica-Bold').fontSize(6);
      doc.text('Nr.', colX[0], tableTop);
      doc.text('Datum', colX[1], tableTop);
      doc.text('Handler', colX[2], tableTop);
      doc.text('Artikel', colX[3], tableTop);
      doc.text('Br. 19%', colX[4], tableTop);
      doc.text('Br. 7%', colX[5], tableTop);
      doc.text('Br. 0%', colX[6], tableTop);
      doc.text('Brutto', colX[7], tableTop);
      doc.text('Nt. 19%', colX[8], tableTop);
      doc.text('Nt. 7%', colX[9], tableTop);
      doc.text('Netto', colX[10], tableTop);

      doc.moveTo(50, tableTop + 10).lineTo(545, tableTop + 10).stroke();

      doc.font('Helvetica').fontSize(6);
      let rowY = tableTop + 14;
      for (let i = 0; i < userBills.length; i++) {
        const bill = userBills[i];
        if (rowY > 750) {
          doc.addPage();
          rowY = 50;
        }
        const b19 = Number(bill.brutto19);
        const b7 = Number(bill.brutto7);
        const b0 = Number(bill.brutto0);
        const n19 = b19 / 1.19;
        const n7 = b7 / 1.07;
        const netto = n19 + n7 + b0;

        doc.text(bill.billNumber || String(i + 1), colX[0], rowY, { width: 23 });
        doc.text(new Date(bill.date).toLocaleDateString('de-DE'), colX[1], rowY, { width: 48 });
        doc.text((bill.vendor || '-').substring(0, 11), colX[2], rowY, { width: 63 });
        doc.text((bill.item || '-').substring(0, 10), colX[3], rowY, { width: 58 });
        doc.text(b19.toFixed(2), colX[4], rowY, { width: 43 });
        doc.text(b7.toFixed(2), colX[5], rowY, { width: 43 });
        doc.text(b0.toFixed(2), colX[6], rowY, { width: 43 });
        doc.font('Helvetica-Bold').text(calculateTotal(b19, b7, b0).toFixed(2), colX[7], rowY, { width: 43 });
        doc.font('Helvetica').text(n19.toFixed(2), colX[8], rowY, { width: 43 });
        doc.text(n7.toFixed(2), colX[9], rowY, { width: 38 });
        doc.font('Helvetica-Bold').text(netto.toFixed(2), colX[10], rowY, { width: 38 });
        doc.font('Helvetica');
        rowY += 11;
      }
      doc.y = rowY;
      if (billsTruncated) {
        doc
          .fontSize(8)
          .fillColor('gray')
          .text(`Hinweis: Es werden nur die ersten ${MAX_REPORT_BILLS} Belege aufgelistet.`, 50);
        doc.fillColor('black');
      }
      doc.moveDown(1);
    }

    // Line separator
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // Summary
    // Only confirmed/approved/paid bills count (draft/pending/rejected are
    // listed above but excluded here), using the same per-bill total formula
    // as the table rows.
    const countedBills = spendingAgg._count._all;
    const total19 = roundCents(Number(spendingAgg._sum.brutto19 ?? 0));
    const total7 = roundCents(Number(spendingAgg._sum.brutto7 ?? 0));
    const total0 = roundCents(Number(spendingAgg._sum.brutto0 ?? 0));
    const totalAmount = roundCents(calculateTotal(total19, total7, total0));
    const totalNetto19 = total19 / 1.19;
    const totalNetto7 = total7 / 1.07;
    const totalNetto = totalNetto19 + totalNetto7 + total0;

    const summaryX = 50;
    const bruttoX = 200;
    const nettoX = 320;

    doc.fontSize(12).font('Helvetica-Bold').text('Ausgaben Zusammenfassung', summaryX);
    doc.moveDown(0.5);
    let summaryY = doc.y;

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('', summaryX, summaryY);
    doc.text('Brutto', bruttoX, summaryY);
    doc.text('Netto', nettoX, summaryY);
    summaryY += 14;

    doc.fontSize(10).font('Helvetica');
    doc.text('Anzahl Belege:', summaryX, summaryY);
    doc.text(String(countedBills), bruttoX, summaryY);
    summaryY += 14;

    doc.text('Gesamt 19%:', summaryX, summaryY);
    doc.text(`${total19.toFixed(2)} EUR`, bruttoX, summaryY);
    doc.text(`${totalNetto19.toFixed(2)} EUR`, nettoX, summaryY);
    summaryY += 14;

    doc.text('Gesamt 7%:', summaryX, summaryY);
    doc.text(`${total7.toFixed(2)} EUR`, bruttoX, summaryY);
    doc.text(`${totalNetto7.toFixed(2)} EUR`, nettoX, summaryY);
    summaryY += 14;

    doc.text('Gesamt 0%:', summaryX, summaryY);
    doc.text(`${total0.toFixed(2)} EUR`, bruttoX, summaryY);
    doc.text(`${total0.toFixed(2)} EUR`, nettoX, summaryY);
    summaryY += 14;

    doc.moveTo(summaryX, summaryY).lineTo(420, summaryY).stroke();
    summaryY += 6;

    doc.font('Helvetica-Bold');
    doc.text('Ausgaben Gesamt:', summaryX, summaryY);
    doc.text(`${totalAmount.toFixed(2)} EUR`, bruttoX, summaryY);
    doc.text(`${totalNetto.toFixed(2)} EUR`, nettoX, summaryY);
    summaryY += 14;

    doc.text('V-Geld Gesamt:', summaryX, summaryY);
    doc.text(`${totalVGeld.toFixed(2)} EUR`, bruttoX, summaryY);
    summaryY += 14;

    const balance = roundCents(totalVGeld - totalAmount);
    doc.fillColor(balance >= 0 ? 'green' : 'red');
    doc.text('Saldo (brutto):', summaryX, summaryY);
    doc.text(`${balance.toFixed(2)} EUR`, bruttoX, summaryY);
    doc.fillColor('black');
    summaryY += 16;

    if (countedBills !== userBills.length || billsTruncated) {
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('gray')
        .text(
          'Hinweis: Summen und Saldo enthalten nur Belege mit Status bestatigt, genehmigt oder bezahlt.',
          summaryX,
          summaryY
        );
      doc.fillColor('black');
      summaryY += 12;
    }

    doc.y = summaryY + 20;

    // New page for bills detail
    if (userBills.length > 0) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('Belege', 50);
      doc.moveDown(1);
    }

    // Each bill detail with images
    for (let i = 0; i < userBills.length; i++) {
      const bill = userBills[i];

      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Beleg ${bill.billNumber || i + 1}`, { continued: true });
      doc.font('Helvetica').text(` - ${new Date(bill.date).toLocaleDateString('de-DE')}`);

      const billMotives = pdfMotiveAllocs[bill.id] || [];
      let motiveStr = bill.motiveLegacy || '-';
      if (billMotives.length > 0) {
        motiveStr =
          billMotives.length === 1 && billMotives[0].percentage === 100
            ? billMotives[0].name
            : billMotives.map((a) => `${a.name} (${a.percentage}%)`).join(', ');
      }

      const billCategories = pdfCategoryAllocs[bill.id] || [];
      let categoryStr = '';
      if (billCategories.length > 0) {
        categoryStr =
          billCategories.length === 1 && billCategories[0].percentage === 100
            ? billCategories[0].name
            : billCategories.map((a) => `${a.name} (${a.percentage}%)`).join(', ');
      }

      doc.fontSize(10).font('Helvetica');
      doc.text(`Typ: ${bill.type || 'Kauf'} | Motiv: ${motiveStr}`);
      if (categoryStr) {
        doc.text(`Kategorie: ${categoryStr}`);
      }
      doc.text(`Handler: ${bill.vendor || '-'} | Artikel: ${bill.item || '-'}`);

      const b19 = Number(bill.brutto19);
      const b7 = Number(bill.brutto7);
      const b0 = Number(bill.brutto0);
      const n19 = b19 / 1.19;
      const n7 = b7 / 1.07;
      const billNetto = n19 + n7 + b0;

      const bruttoAmounts: string[] = [];
      if (b19) bruttoAmounts.push(`19%: ${b19.toFixed(2)}`);
      if (b7) bruttoAmounts.push(`7%: ${b7.toFixed(2)}`);
      if (b0) bruttoAmounts.push(`0%: ${b0.toFixed(2)}`);

      doc.text(
        `Brutto: ${bruttoAmounts.join(' | ') || '-'} | Gesamt: ${calculateTotal(b19, b7, b0).toFixed(2)} EUR`
      );

      const nettoAmounts: string[] = [];
      if (b19) nettoAmounts.push(`19%: ${n19.toFixed(2)}`);
      if (b7) nettoAmounts.push(`7%: ${n7.toFixed(2)}`);
      if (b0) nettoAmounts.push(`0%: ${b0.toFixed(2)}`);

      doc.text(
        `Netto:  ${nettoAmounts.join(' | ') || '-'} | Gesamt: ${billNetto.toFixed(2)} EUR`
      );

      if (bill.comment) {
        doc.text(`Notiz: ${bill.comment}`);
      }
      doc.moveDown(0.5);

      // Images
      const allBillImages = imagesByBillId.get(bill.id) ?? [];
      const billImages = allBillImages.slice(0, MAX_IMAGES_PER_BILL);

      if (billImages.length > 0) {
        for (let imgIdx = 0; imgIdx < billImages.length; imgIdx++) {
          const img = billImages[imgIdx];
          if (!img.filePath) continue;

          // Sanitize path — no directory traversal
          const safeName = path.basename(img.filePath);
          const subDir = path.dirname(img.filePath).replace(/\.\./g, '');
          const imagePath = path.join(UPLOADS_DIR, subDir, safeName);

          if (await fileExists(imagePath)) {
            try {
              const ext = path.extname(imagePath).toLowerCase();
              if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                if (doc.y > 450) {
                  doc.addPage();
                }
                if (billImages.length > 1) {
                  doc
                    .fontSize(8)
                    .fillColor('gray')
                    .text(`Bild ${imgIdx + 1} / ${billImages.length}`);
                  doc.fillColor('black');
                }
                doc.image(imagePath, { fit: [400, 300], align: 'center' });
                doc.moveDown(0.5);
              } else {
                doc
                  .fontSize(9)
                  .fillColor('gray')
                  .text(`[Bild: ${img.filePath} - Format nicht unterstutzt]`);
                doc.fillColor('black');
              }
            } catch (imgErr: any) {
              console.error('PDF image error:', imgErr.message);
              doc
                .fontSize(9)
                .fillColor('gray')
                .text(`[Bild konnte nicht geladen werden: ${img.filePath}]`);
              doc.fillColor('black');
            }
          } else {
            doc
              .fontSize(9)
              .fillColor('gray')
              .text(`[Bild nicht gefunden: ${img.filePath}]`);
            doc.fillColor('black');
          }
        }
      }

      if (allBillImages.length > MAX_IMAGES_PER_BILL) {
        doc
          .fontSize(9)
          .fillColor('gray')
          .text(
            `[Hinweis: Es werden nur die ersten ${MAX_IMAGES_PER_BILL} von ${allBillImages.length} Bildern angezeigt]`
          );
        doc.fillColor('black');
      }

      // New page after each bill (except the last)
      if (i < userBills.length - 1) {
        doc.addPage();
      }
    }

    doc.end();

    const dateStr = new Date().toISOString().split('T')[0];
    const emailLocal = targetEmail.split('@')[0].replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `report_${emailLocal}_${dateStr}.pdf`;

    const stream = new ReadableStream({
      start(controller) {
        pass.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        pass.on('end', () => controller.close());
        pass.on('error', (err: Error) => controller.error(err));
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating user PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
