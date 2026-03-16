// ============================================================================
// GET /api/reports/budget-matrix/pdf
// ============================================================================
// Generates a landscape A4 PDF of the budget matrix with spending data.
// Port of routes/reporting.js lines 474-814
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { exportLimiter } from '@/lib/ratelimit';
import { PassThrough } from 'stream';
// @ts-ignore
import PDFDocument from 'pdfkit';

export async function GET() {
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

    // Verify project membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    if (!membership && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Query motives, categories, budget matrix
    const motivesRaw = await prisma.motive.findMany({
      where: { projectId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
    const motives = motivesRaw.sort((a, b) => {
      if (a.name === 'Default') return -1;
      if (b.name === 'Default') return 1;
      return 0;
    });

    const categoriesRaw = await prisma.category.findMany({
      where: { projectId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
    const categories = categoriesRaw.sort((a, b) => {
      if (a.name === 'Uncategorized') return -1;
      if (b.name === 'Uncategorized') return 1;
      return 0;
    });

    const matrixCells = await prisma.budgetMatrix.findMany({
      where: { projectId },
      select: { motiveId: true, categoryId: true, amount: true },
    });

    const matrix: Record<string, number> = {};
    for (const r of matrixCells) {
      matrix[`${r.categoryId}_${r.motiveId}`] = Number(r.amount);
    }

    // Spending queries via raw SQL
    const motiveSpendingRaw = await prisma.$queryRaw<{ motiveId: string; spent: number }[]>`
      SELECT bm."motiveId", SUM(CAST(b."nettoAmount" AS DOUBLE PRECISION) * CAST(bm.percentage AS DOUBLE PRECISION) / 100) as spent
      FROM "BillMotive" bm JOIN "Bill" b ON b.id = bm."billId"
      WHERE b."projectId" = ${projectId} AND b.status = 'confirmed'::"BillStatus"
      GROUP BY bm."motiveId"
    `;

    const categorySpendingRaw = await prisma.$queryRaw<{ categoryId: string; spent: number }[]>`
      SELECT bc."categoryId", SUM(CAST(b."nettoAmount" AS DOUBLE PRECISION) * CAST(bc.percentage AS DOUBLE PRECISION) / 100) as spent
      FROM "BillCategory" bc JOIN "Bill" b ON b.id = bc."billId"
      WHERE b."projectId" = ${projectId} AND b.status = 'confirmed'::"BillStatus"
      GROUP BY bc."categoryId"
    `;

    const motiveSpending: Record<string, number> = {};
    for (const r of motiveSpendingRaw) {
      motiveSpending[r.motiveId] = Number(r.spent) || 0;
    }

    const categorySpending: Record<string, number> = {};
    for (const r of categorySpendingRaw) {
      categorySpending[r.categoryId] = Number(r.spent) || 0;
    }

    // Project title/subtitle from the Project model
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, subtitle: true },
    });
    const bmTitle = project?.name ?? '';
    const bmSubtitle = project?.subtitle ?? '';
    const bmPrefix = bmTitle ? bmTitle + ' - ' : 'SetCash - ';

    const eur = (v: number) => (v || 0).toFixed(2).replace('.', ',') + ' €';

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const pass = new PassThrough();
    doc.pipe(pass);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text(`${bmPrefix}Budget Matrix (netto)`, { align: 'center' });
    if (bmSubtitle) {
      doc.fontSize(10).font('Helvetica').text(bmSubtitle, { align: 'center' });
    }
    doc.fontSize(10).font('Helvetica').text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' });
    doc.moveDown(1);

    // Table layout
    const leftMargin = 40;
    const rowHeaderWidth = 110;
    const cellWidth =
      motives.length > 0
        ? Math.min(100, (doc.page.width - 80 - rowHeaderWidth - 100 - 100) / motives.length)
        : 80;
    const totalColWidth = 80;
    const spentColWidth = 80;
    const rowHeight = 18;
    const headerHeight = 22;

    let x = leftMargin;
    let y = doc.y;

    // Header row
    doc.fontSize(7).font('Helvetica-Bold');

    // Corner cell
    doc.rect(x, y, rowHeaderWidth, headerHeight).fillAndStroke('#2c3e50', '#999');
    doc.fillColor('#fff').text('Kategorie \\ Motiv', x + 4, y + 6, { width: rowHeaderWidth - 8 });
    x += rowHeaderWidth;

    for (const m of motives) {
      doc.rect(x, y, cellWidth, headerHeight).fillAndStroke('#34495e', '#999');
      doc.fillColor('#fff').text(m.name, x + 3, y + 6, { width: cellWidth - 6, ellipsis: true });
      x += cellWidth;
    }

    doc.rect(x, y, totalColWidth, headerHeight).fillAndStroke('#ecf0f1', '#999');
    doc.fillColor('#2c3e50').text('Budget (netto)', x + 3, y + 6, { width: totalColWidth - 6 });
    x += totalColWidth;

    doc.rect(x, y, spentColWidth, headerHeight).fillAndStroke('#ecf0f1', '#999');
    doc.fillColor('#5b6b7a').text('Ausgaben (netto)', x + 3, y + 6, { width: spentColWidth - 6 });

    y += headerHeight;

    // Data rows
    doc.font('Helvetica').fontSize(7);

    for (const cat of categories) {
      x = leftMargin;

      doc.rect(x, y, rowHeaderWidth, rowHeight).fillAndStroke('#f0f3f6', '#ccc');
      doc.fillColor('#2c3e50').font('Helvetica-Bold').text(cat.name, x + 4, y + 5, {
        width: rowHeaderWidth - 8,
        ellipsis: true,
      });
      x += rowHeaderWidth;

      let rowBudget = 0;
      doc.font('Helvetica');
      for (const m of motives) {
        const val = matrix[`${cat.id}_${m.id}`] || 0;
        rowBudget += val;

        const bgColor = val > 0 ? '#f9fff9' : '#fff';
        doc.rect(x, y, cellWidth, rowHeight).fillAndStroke(bgColor, '#ddd');
        doc.fillColor('#333').text(eur(val), x + 2, y + 5, { width: cellWidth - 4, align: 'right' });
        x += cellWidth;
      }

      doc.rect(x, y, totalColWidth, rowHeight).fillAndStroke('#f7f9fb', '#ccc');
      doc.fillColor('#2c3e50').font('Helvetica-Bold').text(eur(rowBudget), x + 2, y + 5, {
        width: totalColWidth - 4,
        align: 'right',
      });
      x += totalColWidth;

      const catSpent = categorySpending[cat.id] || 0;
      const spentPct = rowBudget > 0 ? catSpent / rowBudget : 0;
      let spentBg = '#f7f9fb';
      let spentColor = '#27ae60';
      if (spentPct >= 1) {
        spentBg = '#fdedec';
        spentColor = '#e74c3c';
      } else if (spentPct >= 0.8) {
        spentBg = '#fef9e7';
        spentColor = '#e67e22';
      }

      doc.rect(x, y, spentColWidth, rowHeight).fillAndStroke(spentBg, '#ccc');
      doc.fillColor(spentColor).font('Helvetica-Bold').text(eur(catSpent), x + 2, y + 5, {
        width: spentColWidth - 4,
        align: 'right',
      });

      y += rowHeight;

      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 40;
      }
    }

    // Footer: Budget totals row
    x = leftMargin;
    doc.font('Helvetica-Bold').fontSize(7);

    doc.rect(x, y, rowHeaderWidth, rowHeight).fillAndStroke('#ecf0f1', '#999');
    doc.fillColor('#2c3e50').text('Budget (netto)', x + 4, y + 5, { width: rowHeaderWidth - 8 });
    x += rowHeaderWidth;

    let footerGrand = 0;
    for (const m of motives) {
      let colTotal = 0;
      for (const cat of categories) {
        colTotal += matrix[`${cat.id}_${m.id}`] || 0;
      }
      footerGrand += colTotal;

      doc.rect(x, y, cellWidth, rowHeight).fillAndStroke('#ecf0f1', '#999');
      doc.fillColor('#2c3e50').text(eur(colTotal), x + 2, y + 5, {
        width: cellWidth - 4,
        align: 'right',
      });
      x += cellWidth;
    }

    doc.rect(x, y, totalColWidth, rowHeight).fillAndStroke('#dce3ea', '#999');
    doc.fillColor('#2c3e50').text(eur(footerGrand), x + 2, y + 5, {
      width: totalColWidth - 4,
      align: 'right',
    });
    x += totalColWidth;

    doc.rect(x, y, spentColWidth, rowHeight).fillAndStroke('#ecf0f1', '#999');

    y += rowHeight;

    // Footer: Spent totals row
    x = leftMargin;

    doc.rect(x, y, rowHeaderWidth, rowHeight).fillAndStroke('#ecf0f1', '#999');
    doc.fillColor('#5b6b7a').text('Ausgaben (netto)', x + 4, y + 5, { width: rowHeaderWidth - 8 });
    x += rowHeaderWidth;

    let footerSpentGrand = 0;
    for (const m of motives) {
      const motSpent = motiveSpending[m.id] || 0;
      footerSpentGrand += motSpent;

      let colBudget = 0;
      for (const cat of categories) {
        colBudget += matrix[`${cat.id}_${m.id}`] || 0;
      }

      const pct = colBudget > 0 ? motSpent / colBudget : 0;
      let bg = '#ecf0f1';
      let clr = '#27ae60';
      if (pct >= 1) {
        bg = '#fdedec';
        clr = '#e74c3c';
      } else if (pct >= 0.8) {
        bg = '#fef9e7';
        clr = '#e67e22';
      }

      doc.rect(x, y, cellWidth, rowHeight).fillAndStroke(bg, '#999');
      doc.fillColor(clr).text(eur(motSpent), x + 2, y + 5, {
        width: cellWidth - 4,
        align: 'right',
      });
      x += cellWidth;
    }

    doc.rect(x, y, totalColWidth, rowHeight).fillAndStroke('#ecf0f1', '#999');
    x += totalColWidth;

    const grandPct = footerGrand > 0 ? footerSpentGrand / footerGrand : 0;
    let grandBg = '#dce3ea';
    let grandClr = '#27ae60';
    if (grandPct >= 1) {
      grandBg = '#fdedec';
      grandClr = '#e74c3c';
    } else if (grandPct >= 0.8) {
      grandBg = '#fef9e7';
      grandClr = '#e67e22';
    }

    doc.rect(x, y, spentColWidth, rowHeight).fillAndStroke(grandBg, '#999');
    doc.fillColor(grandClr).text(eur(footerSpentGrand), x + 2, y + 5, {
      width: spentColWidth - 4,
      align: 'right',
    });

    y += rowHeight + 20;

    // Summary section
    doc.fillColor('#000');
    doc.fontSize(11).font('Helvetica-Bold').text('Zusammenfassung', leftMargin, y);
    y += 18;
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Budget (netto): ${eur(footerGrand)}`, leftMargin, y);
    y += 15;
    doc.text(`Total Ausgaben (netto): ${eur(footerSpentGrand)}`, leftMargin, y);
    y += 15;
    const remaining = footerGrand - footerSpentGrand;
    doc.fillColor(remaining >= 0 ? '#27ae60' : '#e74c3c');
    doc.font('Helvetica-Bold').text(`Verbleibend: ${eur(remaining)}`, leftMargin, y);
    y += 15;
    const usedPct =
      footerGrand > 0
        ? ((footerSpentGrand / footerGrand) * 100).toFixed(1)
        : '0.0';
    doc.text(`Verbraucht: ${usedPct}%`, leftMargin, y);

    doc.end();

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `budget_matrix_${dateStr}.pdf`;

    const readableStream = new ReadableStream({
      start(controller) {
        pass.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        pass.on('end', () => controller.close());
        pass.on('error', (err: Error) => controller.error(err));
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating budget matrix PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
