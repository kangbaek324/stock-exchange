/*
  Warnings:

  - Added the required column `can_money` to the `accounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `accounts` ADD COLUMN `can_money` BIGINT NOT NULL;
