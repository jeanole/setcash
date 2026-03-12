// ============================================================================
// POST /api/admin/export/google-sheet
// ============================================================================
// Exports all project data to a configured Google Sheets spreadsheet.
// Creates/updates 3 tabs: Bills, V-Geld, Budget Matrix
// Port of routes/exports.js lines 390-788
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getSheets } from '@/lib/google';

export async function POST() {
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

    const sheets = await getSheets();
    if (!sheets) {
      return NextResponse.json(
        {
          error:
            'Google services not configured. Please add service account credentials first.',
        },
        { status: 400 }
      );
    }

    // Project settings
    const settingsRaw = await prisma.projectSettings.findMany({ where: { projectId } });
    const settings: Record<string, string> = {};
    settingsRaw.forEach((s) => { if (s.value) settings[s.key] = s.value; });

    const spreadsheetId = settings['exportSheetId'];
    if (!spreadsheetId) {
      return NextResponse.json(
        {
          error:
            'No Export Sheet ID configured. Create a Google Sheet, share it with the service account, and paste the Sheet ID in the Google config.',
        },
        { status: 400 }
      );
    }

    // --- Gather data ---
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

    const vgeld = await prisma.vgeld.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    });

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

    // --- Build sheet data arrays ---
    const billsHeaders = [
      'ID', 'Nr.', 'Date', 'Email', 'Type', 'Vendor', 'Item', 'Comment',
      'Brutto 19%', 'Brutto 7%', 'Brutto 0%', 'Brutto Total', 'Netto',
      'Motives', 'Categories',
    ];
    const billsData: (string | number)[][] = [billsHeaders];

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

      const dateStr = bill.date
        ? new Date(bill.date).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

      billsData.push([
        bill.id, bill.billNumber || '', dateStr, bill.submittedByEmail,
        bill.type || 'Kauf', bill.vendor || '', bill.item || '',
        bill.comment || '', b19, b7, b0, total, netto, motiveStr, categoryStr,
      ]);
    }

    // V-Geld data
    const vgeldHeaders = ['ID', 'Date', 'Amount', 'From', 'To', 'Created By'];
    const vgeldData: (string | number)[][] = [vgeldHeaders];

    for (const v of vgeld) {
      const dateStr = v.date
        ? new Date(v.date).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      vgeldData.push([
        v.id, dateStr, Number(v.amount), v.fromUser || '', v.toUser, v.createdBy || '',
      ]);
    }

    // Budget Matrix data
    const bmHeaders = [
      'Category \\ Motive',
      ...motives.map((m) => m.name),
      'Total Budget',
      'Spent',
    ];
    const bmData: (string | number)[][] = [bmHeaders];

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
      bmData.push(rowData);
    }

    // Totals row
    const totalRowData: (string | number)[] = ['Total'];
    let grandTotal = 0;
    let grandSpent = 0;
    for (const mot of motives) {
      let colTotal = 0;
      for (const cat of categories) colTotal += matrix[`${cat.id}_${mot.id}`] || 0;
      totalRowData.push(colTotal);
      grandTotal += colTotal;
    }
    totalRowData.push(grandTotal);
    for (const cat of categories) grandSpent += categorySpending[cat.id] || 0;
    totalRowData.push(grandSpent);
    bmData.push(totalRowData);

    // Spent row
    const spentRowData: (string | number)[] = ['Spent'];
    for (const mot of motives) spentRowData.push(motiveSpending[mot.id] || 0);
    spentRowData.push(grandSpent);
    spentRowData.push('');
    bmData.push(spentRowData);

    // --- Write to Google Sheet ---
    const requiredTabs = ['Bills', 'V-Geld', 'Budget Matrix'];

    // Ensure required tabs exist, remove extras
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = meta.data.sheets || [];
    const existingNames = existingSheets.map((s: any) => s.properties?.title);
    const setupRequests: any[] = [];

    for (const title of requiredTabs) {
      if (!existingNames.includes(title)) {
        setupRequests.push({ addSheet: { properties: { title } } });
      }
    }
    for (const s of existingSheets) {
      if (!requiredTabs.includes(s.properties?.title ?? '')) {
        setupRequests.push({ deleteSheet: { sheetId: s.properties?.sheetId } });
      }
    }
    if (setupRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: setupRequests },
      });
    }

    // Clear existing data
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges: requiredTabs },
    });

    // Write all data
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: 'Bills!A1', values: billsData },
          { range: 'V-Geld!A1', values: vgeldData },
          { range: 'Budget Matrix!A1', values: bmData },
        ],
      },
    });

    // Format headers: dark bg, white bold text, frozen first row
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetIds: Record<string, number> = {};
    for (const s of (sheetMeta.data.sheets || []) as any[]) {
      sheetIds[s.properties.title] = s.properties.sheetId;
    }

    const formatRequests: any[] = [];
    const headerBg = { red: 0.173, green: 0.243, blue: 0.314, alpha: 1 };
    const headerFg = { red: 1, green: 1, blue: 1, alpha: 1 };

    for (const [name, sheetId] of Object.entries(sheetIds)) {
      const colCount =
        name === 'Bills'
          ? billsHeaders.length
          : name === 'V-Geld'
          ? vgeldHeaders.length
          : bmHeaders.length;

      formatRequests.push({
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      });
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: colCount,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: headerBg,
              textFormat: { bold: true, foregroundColor: headerFg },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return NextResponse.json({ ok: true, sheetUrl });
  } catch (error: any) {
    console.error('Google Sheet export error:', error);
    return NextResponse.json(
      { error: 'Google Sheet export failed: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
