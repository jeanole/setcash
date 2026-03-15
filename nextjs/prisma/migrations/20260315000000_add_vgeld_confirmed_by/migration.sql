-- Add confirmedBy field to Vgeld: stores email of admin who confirmed; null = unconfirmed
ALTER TABLE "Vgeld" ADD COLUMN "confirmedBy" TEXT;
