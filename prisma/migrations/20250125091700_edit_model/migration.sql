/*
  Warnings:

  - You are about to drop the column `phone` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `users_phone_key` ON `users`;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `phone`;
