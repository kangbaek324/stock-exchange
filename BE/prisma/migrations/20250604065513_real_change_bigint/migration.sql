-- AlterTable
ALTER TABLE `order` MODIFY `number` BIGINT NOT NULL,
    MODIFY `match_number` BIGINT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `order_match` MODIFY `number` BIGINT NOT NULL;

-- AlterTable
ALTER TABLE `user_stocks` MODIFY `number` BIGINT NOT NULL,
    MODIFY `can_number` BIGINT NOT NULL,
    MODIFY `total_buy_amount` BIGINT NOT NULL DEFAULT 0;
