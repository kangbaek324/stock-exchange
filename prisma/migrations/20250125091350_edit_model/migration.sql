/*
  Warnings:

  - You are about to alter the column `phone` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Char(13)` to `Int`.

*/
-- AlterTable
ALTER TABLE `users` MODIFY `phone` INTEGER NOT NULL;
