// ============================================================================
// POST /api/admin/export/google-sheet
// ============================================================================
// Exports all project data to a configured Google Sheets spreadsheet.
// Creates/updates 3 tabs: Bills, V-Geld, Budget Matrix
// Port of routes/exports.js lines 390-788
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyAdminRole } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import { getSheets } from '@/lib/google';

// Per-project in-memory sync lock (BUG-67).
// NOTE: This lock is per-process only — multiple Node.js processes (e.g. in a
// horizontally-scaled deployment) each maintain their own Map. A Redis-backed
// distributed lock would be needed for multi-process safety, but is out of
// scope here; the in-memory lock is sufficient for the single-process case.
const syncLocks = new Map<string, boolean>();

// Rows are read from the DB in batches (cursor-paginated) so a large project is
// never loaded in a single query. The hard cap is a safety net against
// runaway memory / Sheets payload size; when it is hit the response reports
// `truncated: true` and the tab's tail is NOT cleared.
const DB_BATCH_SIZE = 1000;
const BILL_EXPORT_LIMIT = 50000;
const VGELD_EXPORT_LIMIT = 50000;
// Max rows sent to the Sheets API per values.batchUpdate request
const SHEET_WRITE_CHUNK = 5000;

/**
 * Neutralise spreadsheet formula injection. The export is written with
 * USER_ENTERED (so dates/numbers keep their native formatting), which means any
 * text starting with = + - @ (or tab / CR) would be evaluated as a formula.
 * Prefixing a single quote forces Sheets to store the value as plain text.
 */
function sanitizeCell(value: string | number): string | number {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

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

    // Re-verify admin authority against the DB (JWT claims may be stale)
    const roleCheck = await verifyAdminRole(session.user.email, projectId);
    if (!roleCheck.authorized) {
      return roleCheck.response!;
    }

    // BUG-67: Reject concurrent syncs for the same project.
    // The lock is acquired here and released in the finally block immediately
    // below. The try/finally wraps EVERY code path after acquisition so the
    // lock is always released — even when getSheets() or any other awaited
    // call throws before reaching the success return.
    if (syncLocks.get(projectId)) {
      return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 });
    }
    syncLocks.set(projectId, true);
    try {

    const sheets = await getSheets(projectId);
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
    // Bills are paged through with a cursor; allocations are loaded per batch via
    // the relation include (no project-wide allocation scans, no N+1).
    const billsHeaders = [
      'ID', 'Nr.', 'Date', 'Email', 'Type', 'Vendor', 'Item', 'Comment',
      'Brutto 19%', 'Brutto 7%', 'Brutto 0%', 'Brutto Total', 'Netto',
      'Motives', 'Categories',
    ];
    const billsData: (string | number)[][] = [billsHeaders];
    let billsTruncated = false;
    let billCursor: string | undefined;

    while (!billsTruncated) {
      const batch = await prisma.bill.findMany({
        where: { projectId },
        orderBy: { id: 'asc' },
        take: DB_BATCH_SIZE,
        ...(billCursor ? { cursor: { id: billCursor }, skip: 1 } : {}),
        include: {
          motives: {
            include: { motive: { select: { name: true } } },
            orderBy: { id: 'asc' },
          },
          categories: {
            include: { category: { select: { name: true } } },
            orderBy: { id: 'asc' },
          },
        },
      });
      if (batch.length === 0) break;

      for (const bill of batch) {
        if (billsData.length - 1 >= BILL_EXPORT_LIMIT) {
          billsTruncated = true;
          break;
        }

        const b19 = Number(bill.brutto19);
        const b7 = Number(bill.brutto7);
        const b0 = Number(bill.brutto0);
        const total = b19 + b7 + b0 || Number(bill.grossAmount);
        const netto = Number(bill.nettoAmount) || b19 / 1.19 + b7 / 1.07 + b0;

        const motiveAllocs = bill.motives.map((a) => ({
          name: a.motive.name,
          percentage: Number(a.percentage),
        }));
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

        const categoryAllocs = bill.categories.map((a) => ({
          name: a.category.name,
          percentage: Number(a.percentage),
        }));
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

      if (batch.length < DB_BATCH_SIZE) break;
      billCursor = batch[batch.length - 1].id;
    }

    if (billsTruncated) {
      console.warn(
        `[Google Sheets export] Project ${projectId} exceeds ${BILL_EXPORT_LIMIT} bills; export truncated.`
      );
    }

    // V-Geld data (also cursor-paginated)
    const vgeldHeaders = ['ID', 'Date', 'Amount', 'From', 'To', 'Created By'];
    const vgeldData: (string | number)[][] = [vgeldHeaders];
    let vgeldTruncated = false;
    let vgeldCursor: string | undefined;

    while (!vgeldTruncated) {
      const batch = await prisma.vgeld.findMany({
        where: { projectId },
        orderBy: { id: 'asc' },
        take: DB_BATCH_SIZE,
        ...(vgeldCursor ? { cursor: { id: vgeldCursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      for (const v of batch) {
        if (vgeldData.length - 1 >= VGELD_EXPORT_LIMIT) {
          vgeldTruncated = true;
          break;
        }
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

      if (batch.length < DB_BATCH_SIZE) break;
      vgeldCursor = batch[batch.length - 1].id;
    }

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

    // Ensure required tabs exist. We intentionally never delete tabs that are
    // not in requiredTabs — the sheet may contain user-added tabs (notes,
    // charts, pivot tables, etc.) that must be preserved across syncs.
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = meta.data.sheets || [];
    const existingNames = existingSheets.map((s: any) => s.properties?.title);
    const setupRequests: any[] = [];

    for (const title of requiredTabs) {
      if (!existingNames.includes(title)) {
        setupRequests.push({ addSheet: { properties: { title } } });
      }
    }
    if (setupRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: setupRequests },
      });
    }

    // Write all data FIRST. If this throws, the previous contents of every
    // tab are left untouched beyond the rows already overwritten — nothing is
    // cleared before the new data is written. Large tabs are split into chunks
    // so a single request never carries an unbounded payload.
    const writeJobs: { range: string; values: (string | number)[][] }[] = [];
    const queueRows = (tab: string, rows: (string | number)[][]) => {
      for (let i = 0; i < rows.length; i += SHEET_WRITE_CHUNK) {
        writeJobs.push({
          range: `${tab}!A${i + 1}`,
          values: rows.slice(i, i + SHEET_WRITE_CHUNK).map((row) => row.map(sanitizeCell)),
        });
      }
    };
    queueRows('Bills', billsData);
    queueRows('V-Geld', vgeldData);
    queueRows('Budget Matrix', bmData);

    let group: typeof writeJobs = [];
    let groupRows = 0;
    const flushGroup = async () => {
      if (group.length === 0) return;
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'USER_ENTERED', data: group },
      });
      group = [];
      groupRows = 0;
    };
    for (const job of writeJobs) {
      if (groupRows + job.values.length > SHEET_WRITE_CHUNK) await flushGroup();
      group.push(job);
      groupRows += job.values.length;
    }
    await flushGroup();

    // Only now clear the leftover tail (rows below the freshly written data)
    // so stale rows from a previous, larger export don't linger. A tab whose
    // export was truncated is never tail-cleared (rows past the cap are not
    // ours to erase). A failure here never leaves a tab empty.
    const tailClearRanges = [
      ...(billsTruncated ? [] : [`Bills!A${billsData.length + 1}:ZZ`]),
      ...(vgeldTruncated ? [] : [`V-Geld!A${vgeldData.length + 1}:ZZ`]),
      `Budget Matrix!A${bmData.length + 1}:ZZ`,
    ];
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges: tailClearRanges },
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
    return NextResponse.json({
      ok: true,
      sheetUrl,
      billCount: billsData.length - 1,
      vgeldCount: vgeldData.length - 1,
      truncated: billsTruncated || vgeldTruncated,
    });

    } finally {
      // Always release the lock — covers early returns, thrown exceptions, and
      // successful completion alike.
      syncLocks.delete(projectId);
    }
  } catch (error: any) {
    console.error('Google Sheet export failed:', error);
    return NextResponse.json({ error: 'Google Sheet export failed. Check server logs for details.' }, { status: 500 });
  }
}
