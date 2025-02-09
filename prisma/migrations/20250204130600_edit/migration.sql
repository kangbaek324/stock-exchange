/*
  Warnings:

  - You are about to drop the column `stock_name` on the `stocks` table. All the data in the column will be lost.
  - You are about to drop the column `stock_price` on the `stocks` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `stocks` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `stocks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `stocks` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `stocks_stock_name_key` ON `stocks`;

-- AlterTable
ALTER TABLE `stocks` DROP COLUMN `stock_name`,
    DROP COLUMN `stock_price`,
    ADD COLUMN `name` VARCHAR(30) NOT NULL,
    ADD COLUMN `price` INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `stocks_name_key` ON `stocks`(`name`);
