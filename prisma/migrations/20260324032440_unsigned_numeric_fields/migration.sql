/*
  Warnings:

  - You are about to alter the column `money` on the `accounts` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `can_money` on the `accounts` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `number` on the `order_matches` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `price` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `number` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `match_number` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `high` on the `stock_histories` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `low` on the `stock_histories` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `close` on the `stock_histories` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `open` on the `stock_histories` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `lower_limit` on the `stock_histories` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `upper_limit` on the `stock_histories` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `price` on the `stocks` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `number` on the `user_stocks` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `can_number` on the `user_stocks` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `average` on the `user_stocks` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.
  - You are about to alter the column `total_buy_amount` on the `user_stocks` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `UnsignedBigInt`.

*/
-- AlterTable
ALTER TABLE `accounts` MODIFY `money` BIGINT UNSIGNED NOT NULL,
    MODIFY `can_money` BIGINT UNSIGNED NOT NULL;

-- AlterTable
ALTER TABLE `order_matches` MODIFY `number` BIGINT UNSIGNED NOT NULL;

-- AlterTable
ALTER TABLE `orders` MODIFY `price` BIGINT UNSIGNED NOT NULL,
    MODIFY `number` BIGINT UNSIGNED NOT NULL,
    MODIFY `match_number` BIGINT UNSIGNED NOT NULL;

-- AlterTable
ALTER TABLE `stock_histories` MODIFY `high` BIGINT UNSIGNED NOT NULL,
    MODIFY `low` BIGINT UNSIGNED NOT NULL,
    MODIFY `close` BIGINT UNSIGNED NOT NULL,
    MODIFY `open` BIGINT UNSIGNED NULL,
    MODIFY `lower_limit` BIGINT UNSIGNED NOT NULL,
    MODIFY `upper_limit` BIGINT UNSIGNED NOT NULL;

-- AlterTable
ALTER TABLE `stocks` MODIFY `price` BIGINT UNSIGNED NOT NULL;

-- AlterTable
ALTER TABLE `user_stocks` MODIFY `number` BIGINT UNSIGNED NOT NULL,
    MODIFY `can_number` BIGINT UNSIGNED NOT NULL,
    MODIFY `average` BIGINT UNSIGNED NOT NULL,
    MODIFY `total_buy_amount` BIGINT UNSIGNED NOT NULL;
