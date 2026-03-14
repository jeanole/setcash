import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  budget: z.number().min(0).optional(),
});

// Helper to check admin access
async function checkAdminAccess(session: any, projectId: string) {
  if (session?.user?.role === 'superadmin') {
    return true;
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userEmail: {
        projectId,
        userEmail: session?.user?.email,
      },
    },
  });

  return membership?.role === 'admin' || membership?.role === 'owner';
}

// PUT /api/projects/[id]/categories/[categoryId] - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  const session = await auth();
  const { id, categoryId } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await checkAdminAccess(session, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if category exists and belongs to project
    const existingCategory = await prisma.category.findFirst({
      where: {
        id: categoryId,
        projectId: id,
      },
    });

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Cannot edit "Uncategorized" category
    if (existingCategory.name === 'Uncategorized') {
      return NextResponse.json(
        { error: 'Cannot edit Uncategorized category' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    // Check for name change conflicts
    if (validated.name && validated.name !== existingCategory.name) {
      // Cannot rename to "Uncategorized"
      if (validated.name === 'Uncategorized') {
        return NextResponse.json(
          { error: "'Uncategorized' is a reserved category name" },
          { status: 400 }
        );
      }

      // Check for duplicate
      const duplicate = await prisma.category.findFirst({
        where: {
          projectId: id,
          name: {
            equals: validated.name,
            mode: 'insensitive',
          },
          id: { not: categoryId },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 400 }
        );
      }
    }

    const updateData: { name?: string; budget?: number } = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.budget !== undefined) updateData.budget = validated.budget;

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: updateData,
      include: {
        billCategories: true,
      },
    });

    return NextResponse.json({
      id: category.id,
      name: category.name,
      budget: Number(category.budget),
      billCount: category.billCategories.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if ((error as any)?.code === 'P2002') {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/categories/[categoryId] - Delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  const session = await auth();
  const { id, categoryId } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await checkAdminAccess(session, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if category exists and belongs to project
    const existingCategory = await prisma.category.findFirst({
      where: {
        id: categoryId,
        projectId: id,
      },
    });

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Cannot delete "Uncategorized" category
    if (existingCategory.name === 'Uncategorized') {
      return NextResponse.json(
        { error: 'Cannot delete Uncategorized category' },
        { status: 400 }
      );
    }

    // Delete in a transaction to ensure atomicity
    await prisma.$transaction([
      prisma.billCategory.deleteMany({ where: { categoryId } }),
      prisma.budgetMatrix.deleteMany({ where: { categoryId } }),
      prisma.category.delete({ where: { id: categoryId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
