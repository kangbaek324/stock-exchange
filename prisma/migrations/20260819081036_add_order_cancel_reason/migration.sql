-- AlterTable
ALTER TABLE `orders` ADD COLUMN `cancel_reason` ENUM('USER', 'SYSTEM') NULL;
