/*
  Warnings:

  - You are about to alter the column `number` on the `order` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `match_number` on the `order` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `number` on the `order_match` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to drop the column `total_buy_number` on the `user_stocks` table. All the data in the column will be lost.
  - You are about to alter the column `number` on the `user_stocks` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `can_number` on the `user_stocks` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `average` on the `user_stocks` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.

*/
-- AlterTable
ALTER TABLE `order` MODIFY `number` INTEGER NOT NULL,
    MODIFY `match_number` INTEGER NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `order_match` MODIFY `number` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `user_stocks` DROP COLUMN `total_buy_number`,
    ADD COLUMN `total_buy_amount` BIGINT NOT NULL DEFAULT 0,
    MODIFY `number` INTEGER NOT NULL,
    MODIFY `can_number` INTEGER NOT NULL,
    MODIFY `average` INTEGER NOT NULL;
