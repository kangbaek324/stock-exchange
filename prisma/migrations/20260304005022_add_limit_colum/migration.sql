-- AlterTable
ALTER TABLE `stock_histories` ADD COLUMN `lower_limit` BIGINT NULL,
    ADD COLUMN `upper_limit` BIGINT NULL;
