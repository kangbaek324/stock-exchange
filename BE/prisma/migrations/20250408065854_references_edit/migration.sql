-- DropForeignKey
ALTER TABLE `user_stocks` DROP FOREIGN KEY `user_stocks_account_id_fkey`;

-- DropIndex
DROP INDEX `user_stocks_account_id_fkey` ON `user_stocks`;

-- AddForeignKey
ALTER TABLE `user_stocks` ADD CONSTRAINT `user_stocks_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
