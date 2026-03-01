import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';

  // 1. Upsert admin user
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      isSuperAdmin: true,
    },
  });
  console.log(`✓ Admin user: ${adminUser.email}`);

  // 2. Create default project if none exists
  const projectCount = await prisma.project.count();
  let defaultProject;
  if (projectCount === 0) {
    defaultProject = await prisma.project.create({
      data: { name: 'Default Project' },
    });
    console.log(`✓ Default project created: ${defaultProject.name}`);
  } else {
    defaultProject = await prisma.project.findFirst();
    console.log(`✓ Default project already exists: ${defaultProject!.name}`);
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
