/*
  Warnings:

  - The primary key for the `cursors` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `cursors` DROP PRIMARY KEY,
    MODIFY `type` ENUM('EVENT', 'DB_APPLIED') NOT NULL,
    ADD PRIMARY KEY (`type`);
