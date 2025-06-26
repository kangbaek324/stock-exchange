/*
  Warnings:

  - The primary key for the `stockhistory` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `stockhistory` DROP PRIMARY KEY,
    MODIFY `date` DATE NOT NULL,
    ADD PRIMARY KEY (`stock_id`, `date`);
