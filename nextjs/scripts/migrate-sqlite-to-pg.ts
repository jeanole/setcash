#!/usr/bin/env tsx
/**
 * SQLite to PostgreSQL Migration Script
 * 
 * Migrates all data from the legacy SQLite database to PostgreSQL via Prisma.
 * Uses in-memory ID mapping to preserve foreign key relationships.
 * Idempotent via upsert on legacyId field.
 */

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';

// ============================================================================
// Configuration
// ============================================================================

const SQLITE_PATH = process.env.SQLITE_PATH || '../../data/vbudget.db';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

// ============================================================================
// ID Mapping Maps (in-memory)
// ============================================================================

const userIdMap: Map<number, string> = new Map();
const projectIdMap: Map<number, string> = new Map();
const projectPositionIdMap: Map<number, string> = new Map();
const projectMemberIdMap: Map<number, string> = new Map();
const motiveIdMap: Map<number, string> = new Map();
const categoryIdMap: Map<number, string> = new Map();
const billIdMap: Map<number, string> = new Map();
const billImageIdMap: Map<number, string> = new Map();
const billMotiveIdMap: Map<number, string> = new Map();
const billCategoryIdMap: Map<number, string> = new Map();
const budgetMatrixIdMap: Map<number, string> = new Map();
const vgeldIdMap: Map<number, string> = new Map();
const editLogIdMap: Map<number, string> = new Map();
const ocrLogIdMap: Map<number, string> = new Map();
const notificationIdMap: Map<number, string> = new Map();
const telegramLinkIdMap: Map<number, string> = new Map();

// ============================================================================
// Migration Results Tracking
// ============================================================================

interface MigrationResult {
  table: string;
  inserted: number;
  errors: number;
  errorDetails: string[];
}

const results: MigrationResult[] = [];

// ============================================================================
// Data Type Helpers
// ============================================================================

function toBoolean(value: number | null): boolean {
  return value === 1;
}

function toDateTime(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function toJson(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toDecimal(value: number | null): Decimal {
  return new Decimal(value ?? 0);
}

// ============================================================================
// Main Migration Function
// ============================================================================

async function migrate() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SQLite to PostgreSQL Migration');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`SQLite: ${SQLITE_PATH}`);
  console.log(`PostgreSQL: ${DATABASE_URL.replace(/\/\/.*@/, '//***@')}`);
  console.log('');

  // Connect to SQLite
  let sqlite: Database.Database;
  try {
    sqlite = new Database(SQLITE_PATH);
    console.log('✓ Connected to SQLite database');
  } catch (err: any) {
    console.error(`✗ Failed to connect to SQLite: ${err.message}`);
    process.exit(1);
  }

  // Connect to PostgreSQL via Prisma
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('✓ Connected to PostgreSQL database');
  } catch (err: any) {
    console.error(`✗ Failed to connect to PostgreSQL: ${err.message}`);
    sqlite.close();
    process.exit(1);
  }

  console.log('');
  console.log('Starting migration...');
  console.log('');

  try {
    // Step 1: Users (Root - no FKs)
    await migrateUsers(sqlite, prisma);

    // Step 2: Projects (Root - no FKs)
    await migrateProjects(sqlite, prisma);

    // Step 3: ProjectPositions
    await migrateProjectPositions(sqlite, prisma);

    // Step 4: ProjectMembers
    await migrateProjectMembers(sqlite, prisma);

    // Step 5: Motives
    await migrateMotives(sqlite, prisma);

    // Step 6: Categories
    await migrateCategories(sqlite, prisma);

    // Step 7: Bills
    await migrateBills(sqlite, prisma);

    // Step 8: BillImages
    await migrateBillImages(sqlite, prisma);

    // Step 9: BillMotives
    await migrateBillMotives(sqlite, prisma);

    // Step 10: BillCategories
    await migrateBillCategories(sqlite, prisma);

    // Step 11: BudgetMatrix
    await migrateBudgetMatrix(sqlite, prisma);

    // Step 12: Vgeld
    await migrateVgeld(sqlite, prisma);

    // Step 13: EditLog
    await migrateEditLog(sqlite, prisma);

    // Step 14: ProjectSettings
    await migrateProjectSettings(sqlite, prisma);

    // Step 15: OcrLog
    await migrateOcrLog(sqlite, prisma);

    // Step 16: TelegramLinks
    await migrateTelegramLinks(sqlite, prisma);

    // Step 17: TelegramLinkCodes
    await migrateTelegramLinkCodes(sqlite, prisma);

    // Step 18: Notifications
    await migrateNotifications(sqlite, prisma);

  } catch (err: any) {
    console.error(`Unexpected error during migration: ${err.message}`);
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }

  // Print summary
  printSummary();
}

// ============================================================================
// Table Migration Functions
// ============================================================================

async function migrateUsers(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'users', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM users').all() as any[];
    
    for (const row of rows) {
      try {
        const newId = uuid();
        
        // First pass: create user without default_project_id
        const user = await prisma.user.upsert({
          where: { legacyId: row.id },
          update: {
            email: row.email,
            passwordHash: row.hash,
            isSuperAdmin: toBoolean(row.super_admin) || toBoolean(row.admin),
            isActive: true,
          },
          create: {
            id: newId,
            legacyId: row.id,
            email: row.email,
            passwordHash: row.hash,
            isSuperAdmin: toBoolean(row.super_admin) || toBoolean(row.admin),
            isActive: true,
          },
        });
        
        userIdMap.set(row.id, user.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`User ${row.id}: ${err.message}`);
      }
    }

    // Second pass: update default_project_id references
    for (const row of rows) {
      if (row.default_project_id && projectIdMap.has(row.default_project_id)) {
        try {
          await prisma.user.update({
            where: { legacyId: row.id },
            data: {
              defaultProjectId: projectIdMap.get(row.default_project_id),
            },
          });
        } catch (err: any) {
          // Non-fatal - just log
          console.warn(`  Warning: Could not update defaultProjectId for user ${row.id}: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateProjects(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'projects', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM projects').all() as any[];
    
    for (const row of rows) {
      try {
        const newId = uuid();
        
        const project = await prisma.project.upsert({
          where: { legacyId: row.id },
          update: {
            name: row.name,
            subtitle: row.subtitle,
            createdAt: toDateTime(row.created_at) || new Date(),
          },
          create: {
            id: newId,
            legacyId: row.id,
            name: row.name,
            subtitle: row.subtitle,
            createdAt: toDateTime(row.created_at) || new Date(),
          },
        });
        
        projectIdMap.set(row.id, project.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`Project ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateProjectPositions(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'project_positions', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM project_positions').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }

        const newId = uuid();
        
        const position = await prisma.projectPosition.upsert({
          where: { legacyId: row.id },
          update: {
            projectId,
            name: row.name,
          },
          create: {
            id: newId,
            legacyId: row.id,
            projectId,
            name: row.name,
          },
        });
        
        projectPositionIdMap.set(row.id, position.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`ProjectPosition ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateProjectMembers(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'project_members', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM project_members').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }

        const positionId = row.position_id ? projectPositionIdMap.get(row.position_id) : null;

        const newId = uuid();
        
        const member = await prisma.projectMember.upsert({
          where: { legacyId: row.id },
          update: {
            projectId,
            userEmail: row.user_email,
            role: row.project_role === 'admin' ? 'admin' : 'user',
            positionId,
          },
          create: {
            id: newId,
            legacyId: row.id,
            projectId,
            userEmail: row.user_email,
            role: row.project_role === 'admin' ? 'admin' : 'user',
            positionId,
          },
        });
        
        projectMemberIdMap.set(row.id, member.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`ProjectMember ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateMotives(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'motives', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM motives').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }

        const newId = uuid();
        
        const motive = await prisma.motive.upsert({
          where: { legacyId: row.id },
          update: {
            projectId,
            name: row.name,
            budget: toDecimal(row.budget),
          },
          create: {
            id: newId,
            legacyId: row.id,
            projectId,
            name: row.name,
            budget: toDecimal(row.budget),
          },
        });
        
        motiveIdMap.set(row.id, motive.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`Motive ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateCategories(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'categories', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM categories').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }

        const newId = uuid();
        
        const category = await prisma.category.upsert({
          where: { legacyId: row.id },
          update: {
            projectId,
            name: row.name,
            budget: toDecimal(row.budget),
          },
          create: {
            id: newId,
            legacyId: row.id,
            projectId,
            name: row.name,
            budget: toDecimal(row.budget),
          },
        });
        
        categoryIdMap.set(row.id, category.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`Category ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateBills(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'bills', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM bills').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }

        const newId = uuid();
        
        // Parse ocr_status enum
        let ocrStatus: 'pending' | 'done' | 'failed' | null = null;
        if (row.ocr_status === 'pending') ocrStatus = 'pending';
        else if (row.ocr_status === 'done') ocrStatus = 'done';
        else if (row.ocr_status === 'failed') ocrStatus = 'failed';

        // Parse status enum
        let status: 'confirmed' | 'pending' | 'approved' | 'rejected' | 'paid' = 'confirmed';
        if (row.status === 'pending') status = 'pending';
        else if (row.status === 'approved') status = 'approved';
        else if (row.status === 'rejected') status = 'rejected';
        else if (row.status === 'paid') status = 'paid';

        const bill = await prisma.bill.upsert({
          where: { legacyId: row.id },
          update: {
            projectId,
            submittedByEmail: row.email,
            date: toDateTime(row.date) || new Date(),
            billNumber: row.bill_number,
            type: row.type,
            vendor: row.vendor,
            item: row.item,
            comment: row.comment,
            motiveLegacy: row.motive,
            brutto19: toDecimal(row.brutto19),
            brutto7: toDecimal(row.brutto7),
            brutto0: toDecimal(row.brutto0),
            nettoAmount: toDecimal(row.netto_amount),
            grossAmount: toDecimal(row.amount),
            status,
            ocrStatus,
            ocrFields: toJson(row.ocr_fields),
            telegramCaption: row.telegram_caption,
            filename: row.filename,
          },
          create: {
            id: newId,
            legacyId: row.id,
            projectId,
            submittedByEmail: row.email,
            date: toDateTime(row.date) || new Date(),
            billNumber: row.bill_number,
            type: row.type,
            vendor: row.vendor,
            item: row.item,
            comment: row.comment,
            motiveLegacy: row.motive,
            brutto19: toDecimal(row.brutto19),
            brutto7: toDecimal(row.brutto7),
            brutto0: toDecimal(row.brutto0),
            nettoAmount: toDecimal(row.netto_amount),
            grossAmount: toDecimal(row.amount),
            status,
            ocrStatus,
            ocrFields: toJson(row.ocr_fields),
            telegramCaption: row.telegram_caption,
            filename: row.filename,
          },
        });
        
        billIdMap.set(row.id, bill.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`Bill ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateBillImages(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'bill_images', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM bill_images').all() as any[];
    
    for (const row of rows) {
      try {
        const billId = billIdMap.get(row.bill_id);
        if (!billId) {
          throw new Error(`Bill ${row.bill_id} not found in mapping`);
        }

        const newId = uuid();
        
        const image = await prisma.billImage.upsert({
          where: { legacyId: row.id },
          update: {
            billId,
            filename: row.filename,
            filePath: row.file,
            sortOrder: row.sort_order || 0,
            createdAt: toDateTime(row.created_at) || new Date(),
          },
          create: {
            id: newId,
            legacyId: row.id,
            billId,
            filename: row.filename,
            filePath: row.file,
            sortOrder: row.sort_order || 0,
            createdAt: toDateTime(row.created_at) || new Date(),
          },
        });
        
        billImageIdMap.set(row.id, image.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`BillImage ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateBillMotives(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'bill_motives', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM bill_motives').all() as any[];
    
    for (const row of rows) {
      try {
        const billId = billIdMap.get(row.bill_id);
        const motiveId = motiveIdMap.get(row.motive_id);
        
        if (!billId) {
          throw new Error(`Bill ${row.bill_id} not found in mapping`);
        }
        if (!motiveId) {
          throw new Error(`Motive ${row.motive_id} not found in mapping`);
        }

        const newId = uuid();
        
        const billMotive = await prisma.billMotive.upsert({
          where: { legacyId: row.id },
          update: {
            billId,
            motiveId,
            percentage: toDecimal(row.percentage),
          },
          create: {
            id: newId,
            legacyId: row.id,
            billId,
            motiveId,
            percentage: toDecimal(row.percentage),
          },
        });
        
        billMotiveIdMap.set(row.id, billMotive.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`BillMotive ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateBillCategories(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'bill_categories', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM bill_categories').all() as any[];
    
    for (const row of rows) {
      try {
        const billId = billIdMap.get(row.bill_id);
        const categoryId = categoryIdMap.get(row.category_id);
        
        if (!billId) {
          throw new Error(`Bill ${row.bill_id} not found in mapping`);
        }
        if (!categoryId) {
          throw new Error(`Category ${row.category_id} not found in mapping`);
        }

        const newId = uuid();
        
        const billCategory = await prisma.billCategory.upsert({
          where: { legacyId: row.id },
          update: {
            billId,
            categoryId,
            percentage: toDecimal(row.percentage),
          },
          create: {
            id: newId,
            legacyId: row.id,
            billId,
            categoryId,
            percentage: toDecimal(row.percentage),
          },
        });
        
        billCategoryIdMap.set(row.id, billCategory.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`BillCategory ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateBudgetMatrix(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'budget_matrix', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM budget_matrix').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        const motiveId = motiveIdMap.get(row.motive_id);
        const categoryId = categoryIdMap.get(row.category_id);
        
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }
        if (!motiveId) {
          throw new Error(`Motive ${row.motive_id} not found in mapping`);
        }
        if (!categoryId) {
          throw new Error(`Category ${row.category_id} not found in mapping`);
        }

        const newId = uuid();
        
        const matrix = await prisma.budgetMatrix.upsert({
          where: { legacyId: row.id },
          update: {
            projectId,
            motiveId,
            categoryId,
            amount: toDecimal(row.amount),
          },
          create: {
            id: newId,
            legacyId: row.id,
            projectId,
            motiveId,
            categoryId,
            amount: toDecimal(row.amount),
          },
        });
        
        budgetMatrixIdMap.set(row.id, matrix.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`BudgetMatrix ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateVgeld(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'vgeld', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM vgeld').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }

        const newId = uuid();
        
        const vgeld = await prisma.vgeld.upsert({
          where: { legacyId: row.id },
          update: {
            projectId,
            date: toDateTime(row.date) || new Date(),
            amount: toDecimal(row.amount),
            fromUser: row.from_user,
            toUser: row.to_user,
            createdBy: row.created_by,
          },
          create: {
            id: newId,
            legacyId: row.id,
            projectId,
            date: toDateTime(row.date) || new Date(),
            amount: toDecimal(row.amount),
            fromUser: row.from_user,
            toUser: row.to_user,
            createdBy: row.created_by,
          },
        });
        
        vgeldIdMap.set(row.id, vgeld.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`Vgeld ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateEditLog(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'editlog', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM editlog').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }

        const billId = row.bill_id ? billIdMap.get(row.bill_id) : null;

        const newId = uuid();
        
        const editLog = await prisma.editLog.upsert({
          where: { legacyId: row.id },
          update: {
            projectId,
            timestamp: toDateTime(row.timestamp) || new Date(),
            user: row.user,
            billId,
            changes: toJson(row.changes) || {},
            source: row.source || 'user',
          },
          create: {
            id: newId,
            legacyId: row.id,
            projectId,
            timestamp: toDateTime(row.timestamp) || new Date(),
            user: row.user,
            billId,
            changes: toJson(row.changes) || {},
            source: row.source || 'user',
          },
        });
        
        editLogIdMap.set(row.id, editLog.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`EditLog ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateProjectSettings(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'project_settings', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM project_settings').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }

        // ProjectSettings uses composite key, so we use a different upsert strategy
        await prisma.projectSettings.upsert({
          where: {
            projectId_key: {
              projectId,
              key: row.key,
            },
          },
          update: {
            value: row.value,
          },
          create: {
            projectId,
            key: row.key,
            value: row.value,
          },
        });
        
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`ProjectSettings ${row.project_id}/${row.key}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateOcrLog(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'ocr_log', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM ocr_log').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = row.project_id ? projectIdMap.get(row.project_id) : null;
        const billId = row.bill_id ? billIdMap.get(row.bill_id) : null;

        const newId = uuid();
        
        const ocrLog = await prisma.ocrLog.upsert({
          where: { legacyId: row.id },
          update: {
            projectId,
            billId,
            timestamp: toDateTime(row.timestamp) || new Date(),
            provider: row.provider,
            status: row.status,
            fieldsWritten: toJson(row.fields_written),
            aiResponse: toJson(row.ai_response),
            errorDetail: row.error_detail,
          },
          create: {
            id: newId,
            legacyId: row.id,
            projectId,
            billId,
            timestamp: toDateTime(row.timestamp) || new Date(),
            provider: row.provider,
            status: row.status,
            fieldsWritten: toJson(row.fields_written),
            aiResponse: toJson(row.ai_response),
            errorDetail: row.error_detail,
          },
        });
        
        ocrLogIdMap.set(row.id, ocrLog.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`OcrLog ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateTelegramLinks(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'telegram_links', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM telegram_links').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }

        const newId = uuid();
        
        const link = await prisma.telegramLink.upsert({
          where: { legacyId: row.id },
          update: {
            projectId,
            telegramUserId: String(row.telegram_user_id),
            userEmail: row.user_email,
            linkedAt: toDateTime(row.linked_at) || new Date(),
          },
          create: {
            id: newId,
            legacyId: row.id,
            projectId,
            telegramUserId: String(row.telegram_user_id),
            userEmail: row.user_email,
            linkedAt: toDateTime(row.linked_at) || new Date(),
          },
        });
        
        telegramLinkIdMap.set(row.id, link.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`TelegramLink ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateTelegramLinkCodes(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'telegram_link_codes', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM telegram_link_codes').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = projectIdMap.get(row.project_id);
        if (!projectId) {
          throw new Error(`Project ${row.project_id} not found in mapping`);
        }

        // TelegramLinkCode uses code as primary key
        await prisma.telegramLinkCode.upsert({
          where: { code: row.code },
          update: {
            userEmail: row.user_email,
            projectId,
            expiresAt: toDateTime(row.expires_at) || new Date(),
            createdAt: toDateTime(row.created_at) || new Date(),
          },
          create: {
            code: row.code,
            userEmail: row.user_email,
            projectId,
            expiresAt: toDateTime(row.expires_at) || new Date(),
            createdAt: toDateTime(row.created_at) || new Date(),
          },
        });
        
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`TelegramLinkCode ${row.code}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

async function migrateNotifications(sqlite: Database.Database, prisma: PrismaClient) {
  const result: MigrationResult = { table: 'notifications', inserted: 0, errors: 0, errorDetails: [] };
  
  try {
    const rows = sqlite.prepare('SELECT * FROM notifications').all() as any[];
    
    for (const row of rows) {
      try {
        const projectId = row.project_id ? projectIdMap.get(row.project_id) : null;

        const newId = uuid();
        
        const notification = await prisma.notification.upsert({
          where: { legacyId: row.id },
          update: {
            userEmail: row.user_email,
            type: row.type,
            message: row.message,
            projectId,
            isRead: toBoolean(row.is_read),
            createdAt: toDateTime(row.created_at) || new Date(),
          },
          create: {
            id: newId,
            legacyId: row.id,
            userEmail: row.user_email,
            type: row.type,
            message: row.message,
            projectId,
            isRead: toBoolean(row.is_read),
            createdAt: toDateTime(row.created_at) || new Date(),
          },
        });
        
        notificationIdMap.set(row.id, notification.id);
        result.inserted++;
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push(`Notification ${row.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push(`General error: ${err.message}`);
  }

  results.push(result);
  logResult(result);
}

// ============================================================================
// Utility Functions
// ============================================================================

function logResult(result: MigrationResult) {
  const symbol = result.errors === 0 ? '✓' : '✗';
  console.log(`${symbol} ${result.table}: ${result.inserted} rows migrated${result.errors > 0 ? `, ${result.errors} errors` : ''}`);
  
  if (result.errors > 0 && result.errorDetails.length > 0) {
    for (const detail of result.errorDetails.slice(0, 3)) {
      console.log(`    Error: ${detail}`);
    }
    if (result.errorDetails.length > 3) {
      console.log(`    ... and ${result.errorDetails.length - 3} more errors`);
    }
  }
}

function printSummary() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Migration Summary');
  console.log('═══════════════════════════════════════════════════════');
  
  let totalInserted = 0;
  let totalErrors = 0;
  
  for (const result of results) {
    const symbol = result.errors === 0 ? '✓' : '✗';
    console.log(`${symbol} ${result.table}: ${result.inserted} rows, ${result.errors} errors`);
    totalInserted += result.inserted;
    totalErrors += result.errors;
  }
  
  console.log('');
  console.log(`Total: ${totalInserted} rows migrated, ${totalErrors} errors`);
  
  if (totalErrors > 0) {
    console.log('');
    console.log('Exit code: 1 (errors occurred)');
    process.exit(1);
  } else {
    console.log('');
    console.log('Exit code: 0 (success)');
    process.exit(0);
  }
}

// ============================================================================
// Run Migration
// ============================================================================

migrate().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
