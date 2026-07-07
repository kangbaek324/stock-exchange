/*
  Warnings:

  - The primary key for the `cursors` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The values [EVENT,DB_APPLIED] on the enum `cursors_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `cursors` DROP PRIMARY KEY,
    MODIFY `type` ENUM('DB_APPLIED_OUTPUT_SEQ', 'MQ_PUBLISHED_OUTPUT_SEQ') NOT NULL,
    ADD PRIMARY KEY (`type`);
