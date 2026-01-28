-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `order_account_id_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `order_stock_id_fkey`;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
