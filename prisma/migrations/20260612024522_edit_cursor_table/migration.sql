/*
  Warnings:

  - You are about to drop the `cursor` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `cursor`;

-- CreateTable
CREATE TABLE `cursors` (
    `type` ENUM('EVENT') NOT NULL,
    `index` BIGINT NOT NULL,

    PRIMARY KEY (`type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
