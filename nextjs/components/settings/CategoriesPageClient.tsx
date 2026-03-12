'use client';

import SettingsSection from '@/components/settings/SettingsSection';
import CategoriesList from '@/components/settings/CategoriesList';
import { useCategories } from '@/lib/hooks/useCategories';

interface CategoriesPageClientProps {
  projectId: string;
}

export default function CategoriesPageClient({ projectId }: CategoriesPageClientProps) {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } = useCategories({ projectId });

  return (
    <SettingsSection
      title="Categories"
      description={`Manage expense categories for budget tracking. ${categories.length} category(s) defined.`}
    >
      <CategoriesList
        categories={categories}
        isLoading={isLoading}
        onCreate={createCategory}
        onUpdate={updateCategory}
        onDelete={deleteCategory}
      />
    </SettingsSection>
  );
}
