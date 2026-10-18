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
import { getBudgetMatrixExportRows, getGrossOnlySummary, grossOnlyNote } from '@/lib/spending';
import { calculateTotal } from '@/lib/utils';
import { PassThrough, Readable } from 'stream';
import ExcelJS from 'exceljs';

// Rows are read from the DB in cursor-paginated batches so no single query
// loads the whole project, and allocations come with each batch (no
// project-wide allocation scans).
const DB_BATCH_SIZE = 1000;

async function* iterateBills(projectId: string) {
  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.bill.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
      take: DB_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
    for (const bill of batch) yield bill;
    if (batch.length < DB_BATCH_SIZE) return;
    cursor = batch[batch.length - 1].id;
  }
}

async function* iterateVgeld(projectId: string) {
  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.vgeld.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
      take: DB_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const v of batch) yield v;
    if (batch.length < DB_BATCH_SIZE) return;
    cursor = batch[batch.length - 1].id;
  }
}

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

    for await (const bill of iterateBills(projectId)) {
      const b19 = Number(bill.brutto19);
      const b7 = Number(bill.brutto7);
      const b0 = Number(bill.brutto0);
      const total = calculateTotal(b19, b7, b0, Number(bill.grossAmount));
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

    // Bills with only a gross amount have Netto 0: say so below the data
    // (spending-status bills, same helper as the budget and spending pages).
    const grossOnlyText = grossOnlyNote(await getGrossOnlySummary(projectId));
    if (grossOnlyText) {
      billsSheet.addRow({}); // blank separator row
      const noteRow = billsSheet.addRow({ id: grossOnlyText });
      noteRow.font = { italic: true, color: { argb: 'FF92400E' } };
    }

    // --- V-Geld sheet ---
    const vgeldSheet = workbook.addWorksheet('V-Geld');
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

    for await (const v of iterateVgeld(projectId)) {
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

    // Rows come from lib/spending so "Spent (brutto)" equals /api/spending
    // (confirmed + approved + paid bills, calculateTotal rule, cent-rounded).
    const bmRows = await getBudgetMatrixExportRows(projectId);
    bmRows.forEach((row) => bmSheet.addRow(row));

    const bmHeaderRow = bmSheet.getRow(1);
    bmHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' },
    };
    bmHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Style totals and spent rows (the last two rows)
    const totalRow = bmSheet.getRow(bmRows.length - 1);
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECF0F1' } };
    const spentRow = bmSheet.getRow(bmRows.length);
    spentRow.font = { bold: true };

    // Format number columns as currency
    for (let c = 2; c <= bmRows[0].length; c++) {
      bmSheet.getColumn(c).numFmt = '#,##0.00 €';
      bmSheet.getColumn(c).width = 14;
    }
    bmSheet.getColumn(1).width = 20;

    // Stream response
    const pass = new PassThrough();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_export_${dateStr}.xlsx`;

    // Readable.toWeb applies backpressure and propagates stream errors/cancellation.
    const readableStream = Readable.toWeb(pass) as unknown as ReadableStream;

    // Trigger writing (don't await — it writes to the pass stream). On failure,
    // destroy the stream with the error so the download aborts instead of hanging.
    workbook.xlsx.write(pass).catch((err) => {
      console.error('Excel write error:', err);
      pass.destroy(err instanceof Error ? err : new Error(String(err)));
    });

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
