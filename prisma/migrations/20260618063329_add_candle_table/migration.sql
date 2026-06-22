-- CreateTable
CREATE TABLE `candles` (
    `stock_id` INTEGER NOT NULL,
    `candle_time` DATETIME(3) NOT NULL,
    `type` VARCHAR(5) NOT NULL,
    `open` BIGINT UNSIGNED NOT NULL,
    `high` BIGINT UNSIGNED NOT NULL,
    `low` BIGINT UNSIGNED NOT NULL,
    `close` BIGINT UNSIGNED NOT NULL,
    `volume` BIGINT UNSIGNED NOT NULL,

    INDEX `candles_stock_id_type_candle_time_idx`(`stock_id`, `type`, `candle_time`),
    PRIMARY KEY (`stock_id`, `candle_time`, `type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `candles` ADD CONSTRAINT `candles_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
