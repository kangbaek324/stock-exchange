/*
  Warnings:

  - Made the column `lower_limit` on table `stock_histories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `upper_limit` on table `stock_histories` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `stock_histories` MODIFY `lower_limit` BIGINT NOT NULL,
    MODIFY `upper_limit` BIGINT NOT NULL;
