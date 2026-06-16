-- AlterTable
ALTER TABLE `accounts` ADD COLUMN `published_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `stocks` MODIFY `status` ENUM('PENDING', 'LISTED', 'SUSPENDED', 'DELISTED') NOT NULL DEFAULT 'LISTED';

-- CreateIndex
CREATE INDEX `accounts_published_at_idx` ON `accounts`(`published_at`);
