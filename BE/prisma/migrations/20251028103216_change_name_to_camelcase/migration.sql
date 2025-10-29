-- AlterTable
ALTER TABLE `order` MODIFY `price` BIGINT NOT NULL;

-- AlterTable
ALTER TABLE `stock_history` MODIFY `high` BIGINT NOT NULL,
    MODIFY `low` BIGINT NOT NULL,
    MODIFY `close` BIGINT NOT NULL,
    MODIFY `open` BIGINT NOT NULL;

-- AlterTable
ALTER TABLE `stocks` MODIFY `price` BIGINT NOT NULL;

-- AlterTable
ALTER TABLE `user_stocks` MODIFY `average` BIGINT NOT NULL;
