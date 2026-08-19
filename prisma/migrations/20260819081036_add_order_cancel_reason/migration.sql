-- AlterTable
ALTER TABLE `orders` ADD COLUMN `cancel_reason` ENUM('USER', 'SYSTEM') NULL;

-- Backfill
UPDATE `orders` SET `cancel_reason` = 'USER' WHERE `trading_type` = 'CANCEL' AND `cancel_reason` IS NULL;
