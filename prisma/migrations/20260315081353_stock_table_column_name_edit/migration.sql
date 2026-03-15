/*
  Warnings:

  - You are about to drop the column `broken_at` on the `stocks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `stocks` DROP COLUMN `broken_at`,
    ADD COLUMN `updated_at` DATETIME(3) NULL;
