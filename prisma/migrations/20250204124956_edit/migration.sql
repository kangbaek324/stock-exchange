-- AlterTable
ALTER TABLE `order` MODIFY `status` ENUM('y', 'n') NULL DEFAULT 'n',
    MODIFY `match_number` INTEGER NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `stocks` MODIFY `broken_at` DATETIME(3) NULL;
