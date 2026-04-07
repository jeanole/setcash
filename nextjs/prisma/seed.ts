import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required for seeding');
  }

  // 1. Upsert admin user
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isSuperAdmin: true, passwordHash, emailVerified: new Date() },
    create: {
      email: adminEmail,
      passwordHash,
      isSuperAdmin: true,
      emailVerified: new Date(),
    },
  });
  console.log(`✓ Admin user: ${adminUser.email}`);

  // 2. Ensure an example project exists
  let defaultProject = await prisma.project.findFirst({ where: { isExample: true } });
  if (!defaultProject) {
    defaultProject = await prisma.project.create({
      data: { name: 'Example Project', isExample: true },
    });
    console.log(`✓ Example project created: ${defaultProject.name}`);
  } else {
    console.log(`✓ Example project exists: ${defaultProject.name}`);
  }

  // Remove legacy "Default Project" if it exists and isn't the example project
  const legacyProject = await prisma.project.findFirst({
    where: { name: 'Default Project', isExample: false },
  });
  if (legacyProject) {
    // Move users pointing at the legacy project to the example project
    await prisma.user.updateMany({
      where: { defaultProjectId: legacyProject.id },
      data: { defaultProjectId: defaultProject!.id },
    });
    await prisma.projectMember.deleteMany({ where: { projectId: legacyProject.id } });
    await prisma.project.delete({ where: { id: legacyProject.id } });
    console.log(`✓ Deleted legacy "Default Project": ${legacyProject.id}`);
  }

  const projectId = defaultProject!.id;

  // 3. Upsert project member (admin user -> default project, role=admin)
  const projectMember = await prisma.projectMember.upsert({
    where: {
      projectId_userEmail: {
        projectId,
        userEmail: adminEmail,
      },
    },
    update: {},
    create: {
      projectId,
      userEmail: adminEmail,
      role: 'admin',
    },
  });
  console.log(`✓ Project member: ${projectMember.userEmail} (${projectMember.role})`);

  // 4. findFirst-or-create default motive "Default"
  let defaultMotive = await prisma.motive.findFirst({
    where: { projectId, name: 'Default' },
  });
  if (!defaultMotive) {
    defaultMotive = await prisma.motive.create({
      data: { projectId, name: 'Default', budget: 0 },
    });
    console.log(`✓ Default motive created: ${defaultMotive.name}`);
  } else {
    console.log(`✓ Default motive already exists: ${defaultMotive.name}`);
  }

  // 5. findFirst-or-create default category "Uncategorized"
  let defaultCategory = await prisma.category.findFirst({
    where: { projectId, name: 'Uncategorized' },
  });
  if (!defaultCategory) {
    defaultCategory = await prisma.category.create({
      data: { projectId, name: 'Uncategorized', budget: 0 },
    });
    console.log(`✓ Default category created: ${defaultCategory.name}`);
  } else {
    console.log(`✓ Default category already exists: ${defaultCategory.name}`);
  }

  // 6. Upsert 6 project positions
  const positionNames = ['Misc', 'Szenenbild', 'Props', 'Set Dec', 'Fahrer', 'Baubühne'];
  for (const name of positionNames) {
    const position = await prisma.projectPosition.upsert({
      where: {
        projectId_name: { projectId, name },
      },
      update: {},
      create: { projectId, name },
    });
    console.log(`✓ Position: ${position.name}`);
  }

  // 7. Update admin user's defaultProjectId
  await prisma.user.update({
    where: { email: adminEmail },
    data: { defaultProjectId: projectId },
  });
  console.log(`✓ Admin user defaultProjectId set to: ${projectId}`);

  // 8. Demo user — credentials from env vars
  const demoEmail = process.env.DEMO_USER_EMAIL;
  const demoPassword = process.env.DEMO_USER_PASSWORD;
  if (!demoEmail || !demoPassword) {
    console.log('⊘ DEMO_USER_EMAIL / DEMO_USER_PASSWORD not set — skipping demo user');
    console.log('Seed complete.');
    return;
  }
  const demoPasswordHash = await bcrypt.hash(demoPassword, 10);

  // Find the example project
  const exampleProject = await prisma.project.findFirst({
    where: { isExample: true },
  });

  if (exampleProject) {
    // Upsert demo user
    const demoUser = await prisma.user.upsert({
      where: { email: demoEmail },
      update: { passwordHash: demoPasswordHash, isDemoAccount: true, emailVerified: new Date(), isActive: true },
      create: {
        email: demoEmail,
        passwordHash: demoPasswordHash,
        isDemoAccount: true,
        emailVerified: new Date(),
        isActive: true,
      },
    });

    // Upsert ProjectMember: demo user -> example project, role=user
    const demoMember = await prisma.projectMember.upsert({
      where: {
        projectId_userEmail: {
          projectId: exampleProject.id,
          userEmail: demoEmail,
        },
      },
      update: {},
      create: {
        projectId: exampleProject.id,
        userEmail: demoEmail,
        role: 'user',
      },
    });
    console.log(`✓ Demo member: ${demoMember.userEmail} (${demoMember.role})`);

    // Set demo user's defaultProjectId to example project
    await prisma.user.update({
      where: { email: demoEmail },
      data: { defaultProjectId: exampleProject.id },
    });

    console.log(`✓ Demo user: ${demoUser.email} (isDemoAccount=true)`);
  } else {
    console.warn('No example project found — skipping demo user setup.');
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
