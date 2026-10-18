/**
 * Budget Matrix "Spent" figures must be identical everywhere (BUG-2/9/12):
 * Excel export, Google-Sheets export, GET /api/budget-matrix and
 * GET /api/spending all use confirmed + approved + paid bills, the
 * calculateTotal rule (grossAmount when the brutto sum is 0) and cent rounding.
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

interface SpendingItem {
  id: string | null;
  name: string;
  spent: number;
}
interface SpendingBody {
  items: SpendingItem[];
  totals: { spent: number };
}

async function fetchSpending(tab: 'motive' | 'category'): Promise<SpendingBody> {
  const res = await getSpending(new NextRequest(`http://localhost/api/spending?tab=${tab}`));
  expect(res.status).toBe(200);
  return res.json();
}

describe('Budget Matrix exports vs /api/spending', () => {
  let ctx: TestContext;
  let motiveIds: string[];
  let categoryIds: string[];

  beforeAll(async () => {
    ctx = await createTestContext();
    const { projectId, userEmail } = ctx;
    const date = new Date('2026-04-01');

    motiveIds = [];
    for (const name of ['M1', 'M2', 'M3']) {
      motiveIds.push((await db.motive.create({ data: { projectId, name, budget: 0 } })).id);
    }
    categoryIds = [];
    for (const name of ['Cat1', 'Cat2']) {
      categoryIds.push((await db.category.create({ data: { projectId, name, budget: 0 } })).id);
    }
    const [m1, m2, m3] = motiveIds;
    const [c1, c2] = categoryIds;

    const addBill = async (
      data: Record<string, unknown>,
      motives: [string, number][],
      categories: [string, number][]
    ) => {
      const bill = await db.bill.create({
        data: { projectId, date, submittedByEmail: userEmail, ...data } as never,
      });
      await db.billMotive.createMany({
        data: motives.map(([motiveId, percentage]) => ({ billId: bill.id, motiveId, percentage })),
      });
      await db.billCategory.createMany({
        data: categories.map(([categoryId, percentage]) => ({ billId: bill.id, categoryId, percentage })),
      });
    };

    await addBill({ status: 'confirmed', brutto19: 100, nettoAmount: 84.03 }, [[m1, 100]], [[c1, 100]]);
    await addBill(
      { status: 'approved', brutto19: 99.99, nettoAmount: 84.03 },
      [[m1, 33.33], [m2, 33.33], [m3, 33.34]],
      [[c1, 50], [c2, 50]]
    );
    await addBill({ status: 'paid', brutto0: 0.15, nettoAmount: 0.05 }, [[m2, 50], [m3, 50]], [[c2, 100]]);
    // OCR "amount" path: grossAmount only
    await addBill({ status: 'approved', grossAmount: 20 }, [[m3, 100]], [[c2, 100]]);
    // Not real spending
    await addBill({ status: 'pending', brutto19: 500, nettoAmount: 420 }, [[m1, 100]], [[c1, 100]]);
    await addBill({ status: 'draft', brutto19: 500, nettoAmount: 420 }, [[m1, 100]], [[c1, 100]]);

    await db.budgetMatrix.createMany({
      data: [
        { projectId, motiveId: m1, categoryId: c1, amount: 200 },
        { projectId, motiveId: m2, categoryId: c2, amount: 50.5 },
      ],
    });
    await db.projectSettings.create({
      data: { projectId, key: 'exportSheetId', value: 'sheet-id-for-test' },
    });

    mockAuth.mockResolvedValue(makeSession(ctx, 'admin') as never);
  });

  afterAll(async () => {
    mockAuth.mockReset();
    await cleanupTestContext(ctx);
  });

  /** Reads the matrix rows as Map<row label, Map<column header, value>>. */
  function toGrid(rows: unknown[][]): Map<string, Map<string, unknown>> {
    const header = rows[0].map(String);
    const grid = new Map<string, Map<string, unknown>>();
    for (const row of rows.slice(1)) {
      grid.set(String(row[0]), new Map(header.map((h, i) => [h, row[i]])));
    }
    return grid;
  }

  async function excelGrid() {
    const res = await getExcelExport();
    expect(res.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await res.arrayBuffer()) as never);
    const sheet = workbook.getWorksheet('Budget Matrix')!;
    const rows: unknown[][] = [];
    sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
    return { rows, grid: toGrid(rows) };
  }

  async function sheetGrid() {
    const written: Record<string, unknown[][]> = {};
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
            for (const job of requestBody.data) {
              written[String(job.range).split('!')[0]] = job.values;
            }
            return {};
          }),
          batchClear: jest.fn().mockResolvedValue({}),
        },
      },
    } as never);

    const res = await postSheetExport();
    expect(res.status).toBe(200);
    return { rows: written['Budget Matrix'], grid: toGrid(written['Budget Matrix']) };
  }

  it('should export the same motive Spent figures as /api/spending in Excel', async () => {
    const { grid } = await excelGrid();
    const spending = await fetchSpending('motive');
    const spentRow = grid.get('Spent (brutto)')!;

    for (const item of spending.items.filter((i) => i.id)) {
      expect(spentRow.get(item.name)).toBe(item.spent);
    }
  });

  it('should export the same category Spent figures as /api/spending in Excel', async () => {
    const { grid } = await excelGrid();
    const spending = await fetchSpending('category');

    for (const item of spending.items.filter((i) => i.id)) {
      expect(grid.get(item.name)!.get('Spent (brutto)')).toBe(item.spent);
    }
  });

  it('should export the /api/spending grand total in Excel', async () => {
    const { grid } = await excelGrid();
    const spending = await fetchSpending('category');

    expect(grid.get('Total')!.get('Spent (brutto)')).toBe(spending.totals.spent);
  });

  it('should count confirmed, approved, paid and grossAmount-only bills but not pending or draft', async () => {
    const { grid } = await excelGrid();

    // 100 + 99.99 + 0.15 + 20
    expect(grid.get('Total')!.get('Spent (brutto)')).toBe(220.14);
    // M2: 33.33% of 99.99 (33.3267) + 0.075 = 33.4017 -> 33.40; M1 is not 0 because
    // the confirmed bill is spending; pending/draft add nothing
    expect(grid.get('Spent (brutto)')!.get('M2')).toBe(33.4);
    expect(grid.get('Spent (brutto)')!.get('M3')).toBe(53.41);
  });

  it('should export the same Spent figures to Google Sheets as to Excel', async () => {
    const excel = await excelGrid();
    const sheet = await sheetGrid();

    expect(sheet.rows[0]).toEqual(excel.rows[0]);
    expect(sheet.rows).toEqual(excel.rows.map((r) => r.map((v) => (v === null ? '' : v))));
  });

  it('should show the same brutto spending on GET /api/budget-matrix as /api/spending', async () => {
    const res = await getBudgetMatrix(new NextRequest('http://localhost/api/budget-matrix'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const motives = await fetchSpending('motive');
    const categories = await fetchSpending('category');

    for (const item of motives.items.filter((i) => i.id)) {
      expect(body.motiveSpendingBrutto[item.id!]).toBe(item.spent);
    }
    for (const item of categories.items.filter((i) => i.id)) {
      expect(body.categorySpendingBrutto[item.id!]).toBe(item.spent);
    }
  });

  it('should count a grossAmount-only bill in the budget matrix cells', async () => {
    const res = await getBudgetMatrix(new NextRequest('http://localhost/api/budget-matrix'));
    const body = await res.json();

    // M3 x Cat2: 99.99 * 33.34% * 50% + 0.15 * 50% + 20 = 16.6683 + 0.075 + 20
    expect(body.cellSpendingBrutto[`${categoryIds[1]}_${motiveIds[2]}`]).toBe(36.74);
  });
});
