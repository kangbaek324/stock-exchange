-- AlterTable
ALTER TABLE `stocks` ADD COLUMN `published_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('PENDING', 'LISTED', 'SUSPENDED', 'DELISTED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `stocks_published_at_idx` ON `stocks`(`published_at`);
