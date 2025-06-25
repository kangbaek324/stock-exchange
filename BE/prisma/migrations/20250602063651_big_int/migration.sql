/*
  Warnings:

  - You are about to alter the column `total_buy_amount` on the `user_stocks` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.

*/
-- AlterTable
ALTER TABLE `user_stocks` MODIFY `total_buy_amount` INTEGER NOT NULL DEFAULT 0;
