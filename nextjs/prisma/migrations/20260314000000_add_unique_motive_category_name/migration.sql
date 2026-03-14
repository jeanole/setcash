-- Add unique constraint on (projectId, name) for Motive
CREATE UNIQUE INDEX "Motive_projectId_name_key" ON "Motive"("projectId", "name");

-- Add unique constraint on (projectId, name) for Category
CREATE UNIQUE INDEX "Category_projectId_name_key" ON "Category"("projectId", "name");
