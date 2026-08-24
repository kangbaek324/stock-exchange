-- CreateTable
CREATE TABLE `transfers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sender_account_id` INTEGER NOT NULL,
    `recipient_account_id` INTEGER NOT NULL,
    `sender_alias` VARCHAR(20) NULL,
    `amount` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('RECEIVED', 'REJECTED', 'COMPLETED') NOT NULL DEFAULT 'RECEIVED',
    `reject_reason` ENUM('INSUFFICIENT_BALANCE', 'INVALID_RECIPIENT', 'SENDER_NOT_ACTIVE', 'RECIPIENT_NOT_ACTIVE', 'SELF_TRANSFER') NULL,
    `published_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `transfers_published_at_idx`(`published_at`),
    INDEX `transfers_sender_account_id_created_at_idx`(`sender_account_id`, `created_at`),
    INDEX `transfers_recipient_account_id_created_at_idx`(`recipient_account_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_sender_account_id_fkey` FOREIGN KEY (`sender_account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_recipient_account_id_fkey` FOREIGN KEY (`recipient_account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
