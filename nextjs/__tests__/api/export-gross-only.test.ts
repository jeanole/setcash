/**
 * BUG-29: bills with only a grossAmount have netto 0. Every place that shows
 * netto figures must say so: Excel / Google-Sheets export note, /api/spending
 * and /api/budget-matrix payloads (real DB, mocked session and Sheets client).
 */

import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getSheets } from '@/lib/google';
import { GET as getSpending } from '@/app/api/spending/route';
import { GET as getBudgetMatrix } from '@/app/api/budget-matrix/route';
import { GET as getExcelExport } from '@/app/api/admin/export/excel/route';
import { POST as postSheetExport } from '@/app/api/admin/export/google-sheet/route';
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

jest.mock('@/auth');
jest.mock('@/lib/google', () => ({ getSheets: jest.fn() }));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGetSheets = getSheets as jest.MockedFunction<typeof getSheets>;

async function billsSheetText(): Promise<string[]> {
  const res = await getExcelExport();
  expect(res.status).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await res.arrayBuffer()) as never);
  const texts: string[] = [];
  workbook.getWorksheet('Bills')!.eachRow((row) => {
    row.eachCell((cell) => {
      if (typeof cell.value === 'string') texts.push(cell.value);
    });
  });
  return texts;
}

// Minimal model of the Sheets cell grid: writes set individual cells, clears
// empty whole row ranges. The Bills tab starts pre-filled with a larger
// previous export (12 rows x 15 columns) to catch stale cells (BUG-30).
async function sheetsBillsRows(): Promise<unknown[][]> {
  const grid: Record<string, unknown[][]> = {
    Bills: Array.from({ length: 12 }, (_, r) => Array.from({ length: 15 }, (__, c) => `old-${r}-${c}`)),
  };
  const writeCells = (range: string, values: unknown[][]) => {
    const [tab, cell] = range.split('!');
    const startRow = Number(cell.replace(/\D/g, ''));
    const rows = (grid[tab] ??= []);
    values.forEach((v, i) => {
      const row = (rows[startRow - 1 + i] ??= []);
      v.forEach((value, c) => { row[c] = value; });
    });
  };
  mockGetSheets.mockResolvedValue({
    spreadsheets: {
      get: jest.fn().mockResolvedValue({
        data: {
          sheets: ['Bills', 'V-Geld', 'Budget Matrix'].map((title, i) => ({
            properties: { title, sheetId: i },
          })),
        },
      }),
      batchUpdate: jest.fn().mockResolvedValue({}),
      values: {
        batchUpdate: jest.fn().mockImplementation(async ({ requestBody }) => {
          for (const job of requestBody.data) writeCells(String(job.range), job.values);
          return {};
        }),
        update: jest.fn().mockImplementation(async ({ range, requestBody }) => {
          writeCells(String(range), requestBody.values);
          return {};
        }),
        batchClear: jest.fn().mockImplementation(async ({ requestBody }) => {
          for (const range of requestBody.ranges as string[]) {
            const [tab, cell] = range.split('!');
            const startRow = Number(cell.match(/A(\d+)/)![1]);
            if (grid[tab]) grid[tab] = grid[tab].slice(0, startRow - 1);
          }
          return {};
        }),
      },
    },
  } as never);

  const res = await postSheetExport();
  expect(res.status).toBe(200);
  // Drop trailing empty rows/cells so the assertions read the visible sheet
  // Array.from turns holes (never-written rows) into undefined entries
  return Array.from(grid['Bills'], (row) => (row ?? []).filter((v) => v !== undefined && v !== ''))
    .filter((row, i, all) => row.length > 0 || all.slice(i + 1).some((r) => r.length > 0));
}

describe('gross-only bills are flagged next to netto figures (BUG-29)', () => {
  let withCtx: TestContext;
  let withoutCtx: TestContext;

  const makeBill = (ctx: TestContext, data: Record<string, unknown>) =>
    db.bill.create({
      data: { projectId: ctx.projectId, date: new Date('2026-04-01'), submittedByEmail: ctx.userEmail, ...data } as never,
    });

  beforeAll(async () => {
    withCtx = await createTestContext();
    withoutCtx = await createTestContext();
    for (const ctx of [withCtx, withoutCtx]) {
      await makeBill(ctx, { status: 'approved', brutto19: 119, grossAmount: 119, nettoAmount: 100 });
      await makeBill(ctx, { status: 'pending', grossAmount: 400 }); // not spending
      await db.projectSettings.create({ data: { projectId: ctx.projectId, key: 'exportSheetId', value: 'sheet-id' } });
    }
    await makeBill(withCtx, { status: 'approved', grossAmount: 50 });
    await makeBill(withCtx, { status: 'paid', grossAmount: 7.5 });
  });

  afterAll(async () => {
    mockAuth.mockReset();
    await cleanupTestContext(withCtx);
    await cleanupTestContext(withoutCtx);
  });

  it('should put a note with count and brutto sum on the Excel Bills sheet', async () => {
    mockAuth.mockResolvedValue(makeSession(withCtx, 'admin') as never);

    const texts = await billsSheetText();

    const note = texts.find((t) => t.startsWith('Note:'));
    expect(note).toContain('2 counted bills');
    expect(note).toContain('57.50 EUR brutto');
    expect(note).toContain('not included in the netto figures');
  });

  it('should not add a note to the Excel export when no such bills exist', async () => {
    mockAuth.mockResolvedValue(makeSession(withoutCtx, 'admin') as never);

    const texts = await billsSheetText();

    expect(texts.some((t) => t.startsWith('Note:'))).toBe(false);
  });

  it('should add the note below the data in the Google-Sheets Bills tab', async () => {
    mockAuth.mockResolvedValue(makeSession(withCtx, 'admin') as never);

    const rows = await sheetsBillsRows();

    // header + 4 bills, a blank row, then the note — no stale cells anywhere
    expect(rows).toHaveLength(7);
    expect(rows[5]).toEqual([]);
    expect(rows[6]).toHaveLength(1);
    expect(String(rows[6][0])).toContain('2 counted bills');
    expect(rows.flat().some((v) => String(v).startsWith('old-'))).toBe(false);
  });

  it('should not add a note to the Google-Sheets export when no such bills exist', async () => {
    mockAuth.mockResolvedValue(makeSession(withoutCtx, 'admin') as never);

    const rows = await sheetsBillsRows();

    expect(rows).toHaveLength(3); // header + 2 bills
    expect(rows.flat().some((v) => String(v).startsWith('old-'))).toBe(false);
  });

  it('should return the gross-only summary from /api/spending for both tabs', async () => {
    mockAuth.mockResolvedValue(makeSession(withCtx, 'admin') as never);

    for (const tab of ['motive', 'category']) {
      const res = await getSpending(new NextRequest(`http://localhost/api/spending?tab=${tab}`));
      const body = await res.json();
      expect(body.grossOnly).toEqual({ count: 2, grossSum: 57.5 });
    }
  });

  it('should return the gross-only summary from /api/budget-matrix', async () => {
    mockAuth.mockResolvedValue(makeSession(withCtx, 'admin') as never);

    const res = await getBudgetMatrix(new NextRequest('http://localhost/api/budget-matrix'));
    const body = await res.json();

    expect(body.grossOnly).toEqual({ count: 2, grossSum: 57.5 });
  });

  it('should report a zero count from /api/spending when no such bills exist', async () => {
    mockAuth.mockResolvedValue(makeSession(withoutCtx, 'admin') as never);

    const res = await getSpending(new NextRequest('http://localhost/api/spending?tab=motive'));
    const body = await res.json();

    expect(body.grossOnly).toEqual({ count: 0, grossSum: 0 });
  });
});
