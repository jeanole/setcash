INSERT INTO "User" ("id", "email", "passwordHash", "isSuperAdmin", "isActive", "createdAt", "defaultProjectId")
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  '$2a$10$kq7UqTpD.fuJhdDB8CDKheKxRomK3dO3OuvI.GYaFJQftHSu6DrC.',
  true,
  true,
  NOW(),
  NULL
);
