-- AlterTable
ALTER TABLE `order` MODIFY `status` ENUM('y', 'n', 'c') NULL DEFAULT 'n';
