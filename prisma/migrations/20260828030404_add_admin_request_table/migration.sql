/*
  Warnings:

  - The values [PRICE_OUT_OF_LIMIT] on the enum `orders_reject_reason` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `orders` MODIFY `reject_reason` ENUM('INVALID_ORDER', 'INSUFFICIENT_BALANCE', 'INSUFFICIENT_STOCK', 'STOCK_NOT_TRADABLE', 'ORDER_NOT_ACTIVE') NULL;

-- CreateTable
CREATE TABLE `admin_requests` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `type` ENUM('STOCK_SUSPEND', 'STOCK_RESUME', 'STOCK_DELIST', 'ACCOUNT_DEPOSIT', 'ACCOUNT_WITHDRAW', 'STOCK_DEPOSIT', 'STOCK_WITHDRAW') NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('RECEIVED', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'RECEIVED',
    `reject_reason` ENUM('TARGET_NOT_FOUND', 'INVALID_STATE', 'INSUFFICIENT_BALANCE', 'INSUFFICIENT_STOCK', 'INVALID_REQUEST') NULL,
    `requested_by` INTEGER NOT NULL,
    `published_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_requests_published_at_idx`(`published_at`),
    INDEX `admin_requests_type_status_created_at_idx`(`type`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin_requests` ADD CONSTRAINT `admin_requests_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
