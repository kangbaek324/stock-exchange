/*
  Warnings:

  - You are about to drop the `order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_match` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stock_history` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_account_id_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_stock_id_fkey`;

-- DropForeignKey
ALTER TABLE `order_match` DROP FOREIGN KEY `order_match_initial_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `order_match` DROP FOREIGN KEY `order_match_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `order_match` DROP FOREIGN KEY `order_match_stock_id_fkey`;

-- DropForeignKey
ALTER TABLE `stock_history` DROP FOREIGN KEY `stock_history_stock_id_fkey`;

-- DropTable
DROP TABLE `order`;

-- DropTable
DROP TABLE `order_match`;

-- DropTable
DROP TABLE `stock_history`;

-- CreateTable
CREATE TABLE `stock_histories` (
    `stock_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `high` BIGINT NOT NULL,
    `low` BIGINT NOT NULL,
    `close` BIGINT NOT NULL,
    `open` BIGINT NOT NULL,

    PRIMARY KEY (`stock_id`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account_id` INTEGER NOT NULL,
    `stock_id` INTEGER NOT NULL,
    `price` BIGINT NOT NULL,
    `number` BIGINT NOT NULL,
    `match_number` BIGINT NULL DEFAULT 0,
    `order_type` ENUM('limit', 'market') NOT NULL,
    `status` ENUM('y', 'n', 'c') NULL DEFAULT 'n',
    `trading_type` ENUM('buy', 'sell') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_matches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stock_id` INTEGER NOT NULL,
    `number` BIGINT NOT NULL,
    `initial_order_id` INTEGER NOT NULL,
    `order_id` INTEGER NOT NULL,
    `matched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_histories` ADD CONSTRAINT `stock_histories_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_matches` ADD CONSTRAINT `order_matches_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_matches` ADD CONSTRAINT `order_matches_initial_order_id_fkey` FOREIGN KEY (`initial_order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_matches` ADD CONSTRAINT `order_matches_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
