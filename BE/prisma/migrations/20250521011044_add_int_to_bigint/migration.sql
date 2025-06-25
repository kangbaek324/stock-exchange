-- AlterTable
ALTER TABLE `order` MODIFY `number` BIGINT NOT NULL,
    MODIFY `match_number` BIGINT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `order_match` MODIFY `number` BIGINT NOT NULL;
