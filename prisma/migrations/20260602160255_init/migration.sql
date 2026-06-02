-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(20) NOT NULL,
    `password` VARCHAR(60) NOT NULL,
    `email` VARCHAR(50) NOT NULL,
    `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `hashed_token` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `account_number` INTEGER NOT NULL,
    `balance` BIGINT UNSIGNED NOT NULL,
    `available_balance` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `accounts_account_number_key`(`account_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stocks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(30) NOT NULL,
    `price` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('LISTED', 'SUSPENDED', 'DELISTED') NOT NULL DEFAULT 'LISTED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `stocks_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_histories` (
    `stock_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `high` BIGINT UNSIGNED NOT NULL,
    `low` BIGINT UNSIGNED NOT NULL,
    `close` BIGINT UNSIGNED NOT NULL,
    `open` BIGINT UNSIGNED NULL,
    `upper_limit` BIGINT UNSIGNED NOT NULL,
    `lower_limit` BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (`stock_id`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_stocks` (
    `account_id` INTEGER NOT NULL,
    `stock_id` INTEGER NOT NULL,
    `quantity` BIGINT UNSIGNED NOT NULL,
    `available_quantity` BIGINT UNSIGNED NOT NULL,
    `average` BIGINT UNSIGNED NOT NULL,
    `total_buy_amount` BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (`account_id`, `stock_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `target_id` BIGINT NULL,
    `account_id` INTEGER NOT NULL,
    `stock_id` INTEGER NOT NULL,
    `price` BIGINT UNSIGNED NOT NULL,
    `quantity` BIGINT UNSIGNED NOT NULL,
    `filled_quantity` BIGINT UNSIGNED NOT NULL,
    `order_type` ENUM('LIMIT', 'MARKET') NOT NULL,
    `status` ENUM('RECEIVED', 'OPEN', 'FILLED', 'CANCELED', 'REPLACED', 'REJECTED') NOT NULL DEFAULT 'RECEIVED',
    `reject_reason` ENUM('INSUFFICIENT_BALANCE', 'INSUFFICIENT_STOCK', 'PRICE_OUT_OF_LIMIT', 'STOCK_NOT_TRADABLE', 'ALREADY_PROCESSED') NULL,
    `trading_type` ENUM('BUY', 'SELL', 'EDIT', 'CANCEL') NOT NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `orders_published_at_idx`(`published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trades` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `stock_id` INTEGER NOT NULL,
    `price` BIGINT UNSIGNED NOT NULL,
    `quantity` BIGINT UNSIGNED NOT NULL,
    `maker_order_id` BIGINT NOT NULL,
    `taker_order_id` BIGINT NOT NULL,
    `matched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snapshots` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `state` LONGBLOB NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cursor` (
    `type` ENUM('DB', 'MQ') NOT NULL,
    `index` BIGINT NOT NULL,

    PRIMARY KEY (`type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_histories` ADD CONSTRAINT `stock_histories_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_stocks` ADD CONSTRAINT `user_stocks_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_stocks` ADD CONSTRAINT `user_stocks_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `trades` ADD CONSTRAINT `trades_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trades` ADD CONSTRAINT `trades_maker_order_id_fkey` FOREIGN KEY (`maker_order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trades` ADD CONSTRAINT `trades_taker_order_id_fkey` FOREIGN KEY (`taker_order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
