/*
  Warnings:

  - Added the required column `open` to the `stock_history` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `stock_history` ADD COLUMN `open` INTEGER NOT NULL;
