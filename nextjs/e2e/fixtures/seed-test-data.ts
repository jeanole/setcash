/**
 * Seed E2E test data into the database
 *
 * Creates test users, projects, memberships, categories, motives,
 * budget matrix entries, and sample bills.
 *
 * Idempotent: deletes existing E2E test data before re-creating.
 */

import { PrismaClient, ProjectRole, BillStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { USERS, PROJECTS, CATEGORIES, MOTIVES, TEST_PASSWORD } from './constants';

const prisma = new PrismaClient();

async function seed() {
  console.log('[E2E Seed] Starting test data seeding...');

  // Clean up any existing E2E data first
  const e2eEmails = Object.values(USERS).map((u) => u.email);
  await prisma.user.deleteMany({ where: { email: { in: e2eEmails } } });
  await prisma.project.deleteMany({
    where: { name: { in: Object.values(PROJECTS).map((p) => p.name) } },
  });

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // -------------------------------------------------------------------------
  // Create users
  // -------------------------------------------------------------------------
  const [adminUser, regularUser, user2, orphanUser, superUser, demoUser, disabledUser] =
    await Promise.all([
      prisma.user.create({
        data: {
          email: USERS.admin.email,
          passwordHash,
          emailVerified: new Date(),
          firstName: USERS.admin.firstName,
          lastName: USERS.admin.lastName,
        },
      }),
      prisma.user.create({
        data: {
          email: USERS.user.email,
          passwordHash,
          emailVerified: new Date(),
          firstName: USERS.user.firstName,
          lastName: USERS.user.lastName,
        },
      }),
      prisma.user.create({
        data: {
          email: USERS.user2.email,
          passwordHash,
          emailVerified: new Date(),
          firstName: USERS.user2.firstName,
          lastName: USERS.user2.lastName,
        },
      }),
      prisma.user.create({
        data: {
          email: USERS.orphan.email,
          passwordHash,
          emailVerified: new Date(),
          firstName: USERS.orphan.firstName,
          lastName: USERS.orphan.lastName,
        },
      }),
      prisma.user.create({
        data: {
          email: USERS.superadmin.email,
          passwordHash,
          emailVerified: new Date(),
          isSuperAdmin: true,
          firstName: USERS.superadmin.firstName,
          lastName: USERS.superadmin.lastName,
        },
      }),
      prisma.user.create({
        data: {
          email: USERS.demo.email,
          passwordHash,
          emailVerified: new Date(),
          isDemoAccount: true,
          firstName: USERS.demo.firstName,
          lastName: USERS.demo.lastName,
        },
      }),
      prisma.user.create({
        data: {
          email: USERS.disabled.email,
          passwordHash,
          emailVerified: new Date(),
          isActive: false,
          firstName: USERS.disabled.firstName,
          lastName: USERS.disabled.lastName,
        },
      }),
    ]);

  console.log('[E2E Seed] Created 7 test users');

  // -------------------------------------------------------------------------
  // Create projects
  // -------------------------------------------------------------------------
  const [projectA, projectB, exampleProject] = await Promise.all([
    prisma.project.create({ data: { name: PROJECTS.a.name } }),
    prisma.project.create({ data: { name: PROJECTS.b.name } }),
    prisma.project.create({ data: { name: PROJECTS.example.name, isExample: true } }),
  ]);

  console.log('[E2E Seed] Created 3 test projects');

  // -------------------------------------------------------------------------
  // Create memberships
  // -------------------------------------------------------------------------
  await Promise.all([
    // Project A: admin (owner), user (user), user2 (user)
    prisma.projectMember.create({
      data: { projectId: projectA.id, userEmail: adminUser.email, role: ProjectRole.owner },
    }),
    prisma.projectMember.create({
      data: { projectId: projectA.id, userEmail: regularUser.email, role: ProjectRole.user },
    }),
    prisma.projectMember.create({
      data: { projectId: projectA.id, userEmail: user2.email, role: ProjectRole.user },
    }),
    // Project B: admin (admin), user2 (user)
    prisma.projectMember.create({
      data: { projectId: projectB.id, userEmail: adminUser.email, role: ProjectRole.admin },
    }),
    prisma.projectMember.create({
      data: { projectId: projectB.id, userEmail: user2.email, role: ProjectRole.user },
    }),
    // Example project: demo user
    prisma.projectMember.create({
      data: { projectId: exampleProject.id, userEmail: demoUser.email, role: ProjectRole.user },
    }),
  ]);

  // Set default projects
  await Promise.all([
    prisma.user.update({ where: { id: adminUser.id }, data: { defaultProjectId: projectA.id } }),
    prisma.user.update({ where: { id: regularUser.id }, data: { defaultProjectId: projectA.id } }),
    prisma.user.update({ where: { id: user2.id }, data: { defaultProjectId: projectA.id } }),
    prisma.user.update({ where: { id: superUser.id }, data: { defaultProjectId: projectA.id } }),
    prisma.user.update({ where: { id: demoUser.id }, data: { defaultProjectId: exampleProject.id } }),
  ]);

  console.log('[E2E Seed] Created memberships and default projects');

  // -------------------------------------------------------------------------
  // Create categories
  // -------------------------------------------------------------------------
  const categoriesA = await Promise.all(
    CATEGORIES.a.map((name, i) =>
      prisma.category.create({
        data: { projectId: projectA.id, name, budget: (i + 1) * 1000 },
      })
    )
  );

  const categoriesB = await Promise.all(
    CATEGORIES.b.map((name, i) =>
      prisma.category.create({
        data: { projectId: projectB.id, name, budget: (i + 1) * 500 },
      })
    )
  );

  // -------------------------------------------------------------------------
  // Create motives
  // -------------------------------------------------------------------------
  const motivesA = await Promise.all(
    MOTIVES.a.map((name, i) =>
      prisma.motive.create({
        data: { projectId: projectA.id, name, budget: (i + 1) * 2000 },
      })
    )
  );

  const motivesB = await Promise.all(
    MOTIVES.b.map((name, i) =>
      prisma.motive.create({
        data: { projectId: projectB.id, name, budget: (i + 1) * 1500 },
      })
    )
  );

  console.log('[E2E Seed] Created categories and motives');

  // -------------------------------------------------------------------------
  // Create budget matrix entries for Project A (3x3 = 9 cells)
  // -------------------------------------------------------------------------
  const matrixEntries = [];
  for (const motive of motivesA) {
    for (const category of categoriesA) {
      matrixEntries.push({
        projectId: projectA.id,
        motiveId: motive.id,
        categoryId: category.id,
        amount: Math.floor(Math.random() * 500 + 100),
      });
    }
  }
  await prisma.budgetMatrix.createMany({ data: matrixEntries });

  console.log('[E2E Seed] Created 9 budget matrix entries');

  // -------------------------------------------------------------------------
  // Create sample bills for Project A
  // -------------------------------------------------------------------------
  const statuses: BillStatus[] = [
    'draft', 'draft', 'confirmed', 'confirmed',
    'approved', 'approved', 'approved', 'paid', 'paid', 'rejected',
  ];
  const vendors = [
    'Office Depot', 'Amazon', 'Delta Airlines', 'Starbucks',
    'Best Buy', 'Uber', 'Costco', 'FedEx', 'Hilton', 'Staples',
  ];

  for (let i = 0; i < 10; i++) {
    const bill = await prisma.bill.create({
      data: {
        projectId: projectA.id,
        submittedByEmail: i < 5 ? adminUser.email : regularUser.email,
        date: new Date(2026, 2, i + 1), // March 2026
        billNumber: `E2E-${String(i + 1).padStart(4, '0')}`,
        type: i % 2 === 0 ? 'Kauf' : 'Rechnung',
        vendor: vendors[i],
        item: `Test item ${i + 1}`,
        comment: i % 3 === 0 ? `Test comment for bill ${i + 1}` : null,
        brutto19: (i + 1) * 11.9,
        brutto7: i % 2 === 0 ? (i + 1) * 5.35 : 0,
        brutto0: 0,
        nettoAmount: (i + 1) * 10 + (i % 2 === 0 ? (i + 1) * 5 : 0),
        grossAmount: (i + 1) * 11.9 + (i % 2 === 0 ? (i + 1) * 5.35 : 0),
        status: statuses[i],
      },
    });

    // Add motive/category allocations for non-draft bills
    if (statuses[i] !== 'draft') {
      await prisma.billMotive.create({
        data: {
          billId: bill.id,
          motiveId: motivesA[i % motivesA.length].id,
          percentage: 100,
        },
      });
      await prisma.billCategory.create({
        data: {
          billId: bill.id,
          categoryId: categoriesA[i % categoriesA.length].id,
          percentage: 100,
        },
      });
    }
  }

  console.log('[E2E Seed] Created 10 sample bills');

  // -------------------------------------------------------------------------
  // Create sample V-Geld transfers
  // -------------------------------------------------------------------------
  await prisma.vgeld.createMany({
    data: [
      {
        projectId: projectA.id,
        date: new Date(2026, 2, 1),
        amount: 100,
        fromUser: adminUser.email,
        toUser: regularUser.email,
        createdBy: adminUser.email,
        confirmedBy: adminUser.email,
      },
      {
        projectId: projectA.id,
        date: new Date(2026, 2, 5),
        amount: 50,
        fromUser: regularUser.email,
        toUser: adminUser.email,
        createdBy: regularUser.email,
        confirmedBy: null,
      },
    ],
  });

  console.log('[E2E Seed] Created V-Geld transfers');

  // -------------------------------------------------------------------------
  // Create notifications
  // -------------------------------------------------------------------------
  await prisma.notification.createMany({
    data: [
      {
        userEmail: regularUser.email,
        type: 'bill_rejected',
        message: 'Your bill E2E-0010 was rejected',
        projectId: projectA.id,
        isRead: false,
      },
      {
        userEmail: regularUser.email,
        type: 'bill_approved',
        message: 'Your bill E2E-0008 was approved',
        projectId: projectA.id,
        isRead: true,
      },
    ],
  });

  console.log('[E2E Seed] Created notifications');
  console.log('[E2E Seed] Done!');
}

seed()
  .catch((e) => {
    console.error('[E2E Seed] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
