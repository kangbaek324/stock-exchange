/*
  Warnings:

  - You are about to drop the `Cursor` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `input_wal_index` to the `snapshots` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `snapshots` ADD COLUMN `input_wal_index` BIGINT UNSIGNED NOT NULL;

-- DropTable
DROP TABLE `Cursor`;

-- CreateTable
CREATE TABLE `cursor` (
    `type` ENUM('DB', 'MQ') NOT NULL,
    `index` BIGINT NOT NULL,

    PRIMARY KEY (`type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
