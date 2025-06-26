/*
  Warnings:

  - You are about to drop the `stockhistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `stockhistory` DROP FOREIGN KEY `stockHistory_stock_id_fkey`;

-- DropTable
DROP TABLE `stockhistory`;

-- CreateTable
CREATE TABLE `stock_history` (
    `stock_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `high` INTEGER NOT NULL,
    `low` INTEGER NOT NULL,
    `close` INTEGER NOT NULL,

    PRIMARY KEY (`stock_id`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_history` ADD CONSTRAINT `stock_history_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
