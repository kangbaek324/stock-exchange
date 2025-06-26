-- CreateTable
CREATE TABLE `stockHistory` (
    `stock_id` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `high` INTEGER NOT NULL,
    `low` INTEGER NOT NULL,
    `close` INTEGER NOT NULL,

    PRIMARY KEY (`stock_id`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stockHistory` ADD CONSTRAINT `stockHistory_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
