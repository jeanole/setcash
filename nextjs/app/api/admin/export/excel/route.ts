// ============================================================================
// GET /api/admin/export/excel
// ============================================================================
// Exports all project data as an Excel workbook with 3 sheets:
// Bills, V-Geld, Budget Matrix
// Port of routes/exports.js lines 12-312
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { exportLimiter } from '@/lib/ratelimit';
import { verifyAdminRole } from '@/lib/auth-guard';
import { PassThrough } from 'stream';
import ExcelJS from 'exceljs';

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

    const isAdmin =
      session.user.role === 'superadmin' ||
      session.user.currentProjectRole === 'admin' ||
      session.user.currentProjectRole === 'owner';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SEC-02: re-verify admin authority against the DB before exporting
    // full-project financial data — forces re-auth if the caller was demoted
    // mid-session but is still carrying a stale JWT claiming an elevated role.
    const guard = await verifyAdminRole(session.user.email ?? '', projectId);
    if (!guard.authorized) {
      return guard.response!;
    }

    // Rate limit by user email
    const { success } = await exportLimiter.limit(session.user.email);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Project settings
    const settingsRaw = await prisma.projectSettings.findMany({ where: { projectId } });
    const settings: Record<string, string> = {};
    settingsRaw.forEach((s) => { if (s.value) settings[s.key] = s.value; });
    const projectName = settings['projectTitle'] ?? 'SetCash';

    const workbook = new ExcelJS.Workbook();

    // --- Bills sheet ---
    const billsSheet = workbook.addWorksheet('Bills');

    const bills = await prisma.bill.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    });

    const allMotiveAllocs = await prisma.billMotive.findMany({
      where: { bill: { projectId } },
      include: { motive: { select: { name: true } } },
      orderBy: [{ billId: 'asc' }, { id: 'asc' }],
    });
    const allCategoryAllocs = await prisma.billCategory.findMany({
      where: { bill: { projectId } },
      include: { category: { select: { name: true } } },
      orderBy: [{ billId: 'asc' }, { id: 'asc' }],
    });

    const motivesByBill: Record<string, { name: string; percentage: number }[]> = {};
    for (const a of allMotiveAllocs) {
      if (!motivesByBill[a.billId]) motivesByBill[a.billId] = [];
      motivesByBill[a.billId].push({ name: a.motive.name, percentage: Number(a.percentage) });
    }
    const categoriesByBill: Record<string, { name: string; percentage: number }[]> = {};
    for (const a of allCategoryAllocs) {
      if (!categoriesByBill[a.billId]) categoriesByBill[a.billId] = [];
      categoriesByBill[a.billId].push({ name: a.category.name, percentage: Number(a.percentage) });
    }

    billsSheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: 'Nr.', key: 'bill_number', width: 10 },
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Item', key: 'item', width: 24 },
      { header: 'Comment', key: 'comment', width: 24 },
      { header: 'Brutto 19%', key: 'brutto19', width: 14 },
      { header: 'Brutto 7%', key: 'brutto7', width: 14 },
      { header: 'Brutto 0%', key: 'brutto0', width: 14 },
      { header: 'Brutto Total', key: 'brutto_total', width: 14 },
      { header: 'Netto', key: 'netto', width: 14 },
      { header: 'Motives', key: 'motives', width: 30 },
      { header: 'Categories', key: 'categories', width: 30 },
    ];

    billsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' },
    };
    billsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const bill of bills) {
      const b19 = Number(bill.brutto19);
      const b7 = Number(bill.brutto7);
      const b0 = Number(bill.brutto0);
      const total = b19 + b7 + b0 || Number(bill.grossAmount);
      const netto = Number(bill.nettoAmount) || b19 / 1.19 + b7 / 1.07 + b0;

      const motiveAllocs = motivesByBill[bill.id] || [];
      const motiveStr =
        motiveAllocs
          .map((a) =>
            motiveAllocs.length === 1 && a.percentage === 100
              ? a.name
              : `${a.name} (${Math.round(a.percentage)}%)`
          )
          .join(', ') ||
        bill.motiveLegacy ||
        '';

      const categoryAllocs = categoriesByBill[bill.id] || [];
      const categoryStr = categoryAllocs
        .map((a) =>
          categoryAllocs.length === 1 && a.percentage === 100
            ? a.name
            : `${a.name} (${Math.round(a.percentage)}%)`
        )
        .join(', ');

      billsSheet.addRow({
        id: bill.id,
        bill_number: bill.billNumber || '',
        date: bill.date ? new Date(bill.date) : '',
        email: bill.submittedByEmail,
        type: bill.type || 'Kauf',
        vendor: bill.vendor || '',
        item: bill.item || '',
        comment: bill.comment || '',
        brutto19: b19,
        brutto7: b7,
        brutto0: b0,
        brutto_total: total,
        netto: netto,
        motives: motiveStr,
        categories: categoryStr,
      });
    }

    ['brutto19', 'brutto7', 'brutto0', 'brutto_total', 'netto'].forEach((key) => {
      billsSheet.getColumn(key).numFmt = '#,##0.00 €';
    });
    billsSheet.getColumn('date').numFmt = 'DD.MM.YYYY HH:MM';

    // --- V-Geld sheet ---
    const vgeldSheet = workbook.addWorksheet('V-Geld');
    const vgeld = await prisma.vgeld.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    });

    vgeldSheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'From', key: 'from_user', width: 24 },
      { header: 'To', key: 'to_user', width: 24 },
      { header: 'Created By', key: 'created_by', width: 24 },
    ];

    vgeldSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' },
    };
    vgeldSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const v of vgeld) {
      vgeldSheet.addRow({
        id: v.id,
        date: v.date ? new Date(v.date) : '',
        amount: Number(v.amount),
        from_user: v.fromUser || '',
        to_user: v.toUser,
        created_by: v.createdBy || '',
      });
    }
    vgeldSheet.getColumn('amount').numFmt = '#,##0.00 €';
    vgeldSheet.getColumn('date').numFmt = 'DD.MM.YYYY HH:MM';

    // --- Budget Matrix sheet ---
    const bmSheet = workbook.addWorksheet('Budget Matrix');

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

    // Spending data
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
    for (const r of motiveSpendingRaw) motiveSpending[r.motiveId] = Number(r.spent) || 0;
    const categorySpending: Record<string, number> = {};
    for (const r of categorySpendingRaw) categorySpending[r.categoryId] = Number(r.spent) || 0;

    const bmHeaders = [
      'Category \\ Motive',
      ...motives.map((m) => m.name),
      'Total Budget',
      'Spent',
    ];
    bmSheet.addRow(bmHeaders);
    const bmHeaderRow = bmSheet.getRow(1);
    bmHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' },
    };
    bmHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const cat of categories) {
      const rowData: (string | number)[] = [cat.name];
      let rowTotal = 0;
      for (const mot of motives) {
        const val = matrix[`${cat.id}_${mot.id}`] || 0;
        rowData.push(val);
        rowTotal += val;
      }
      rowData.push(rowTotal);
      rowData.push(categorySpending[cat.id] || 0);
      bmSheet.addRow(rowData);
    }

    // Totals row
    const totalRowData: (string | number)[] = ['Total'];
    let grandTotal = 0;
    let grandSpent = 0;
    for (const mot of motives) {
      let colTotal = 0;
      for (const cat of categories) {
        colTotal += matrix[`${cat.id}_${mot.id}`] || 0;
      }
      totalRowData.push(colTotal);
      grandTotal += colTotal;
    }
    totalRowData.push(grandTotal);
    for (const cat of categories) grandSpent += categorySpending[cat.id] || 0;
    totalRowData.push(grandSpent);
    bmSheet.addRow(totalRowData);

    // Spent row (per motive)
    const spentRowData: (string | number)[] = ['Spent'];
    for (const mot of motives) spentRowData.push(motiveSpending[mot.id] || 0);
    spentRowData.push(grandSpent);
    spentRowData.push('');
    bmSheet.addRow(spentRowData);

    // Style totals and spent rows
    const totalRow = bmSheet.getRow(categories.length + 2);
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECF0F1' } };
    const spentRow = bmSheet.getRow(categories.length + 3);
    spentRow.font = { bold: true };

    // Format number columns as currency
    for (let c = 2; c <= motives.length + 3; c++) {
      bmSheet.getColumn(c).numFmt = '#,##0.00 €';
      bmSheet.getColumn(c).width = 14;
    }
    bmSheet.getColumn(1).width = 20;

    // Stream response
    const pass = new PassThrough();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_export_${dateStr}.xlsx`;

    const streamPromise = workbook.xlsx.write(pass);

    const readableStream = new ReadableStream({
      start(controller) {
        pass.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        pass.on('end', () => controller.close());
        pass.on('error', (err: Error) => controller.error(err));
      },
    });

    // Trigger writing (don't await — it writes to pass stream)
    streamPromise.catch((err) => console.error('Excel write error:', err));

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
