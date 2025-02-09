-- AlterTable
ALTER TABLE `order` MODIFY `status` ENUM('y', 'n') NOT NULL DEFAULT 'n';
