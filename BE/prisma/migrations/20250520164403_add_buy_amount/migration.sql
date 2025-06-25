-- AlterTable
ALTER TABLE `user_stocks` ADD COLUMN `total_buy_number` BIGINT NOT NULL DEFAULT 0,
    MODIFY `number` BIGINT NOT NULL,
    MODIFY `can_number` BIGINT NOT NULL;
