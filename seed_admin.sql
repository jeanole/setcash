INSERT INTO "User" (id, email, "passwordHash", "isSuperAdmin", "isActive") 
VALUES (gen_random_uuid(), 'admin@example.com', '$2a$10$JtmSA2k.Lj4.Q1pS0focHuEn1zM0C0xz8vX5u9K3v3yX2v3yX2v3y', true, true) 
ON CONFLICT (email) DO NOTHING;
