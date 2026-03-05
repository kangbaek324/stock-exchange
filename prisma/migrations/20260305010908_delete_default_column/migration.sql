/*
  Warnings:

  - Made the column `match_number` on table `orders` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `orders` MODIFY `match_number` BIGINT NOT NULL;

-- AlterTable
ALTER TABLE `user_stocks` ALTER COLUMN `total_buy_amount` DROP DEFAULT;
