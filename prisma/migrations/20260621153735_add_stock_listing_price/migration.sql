/*
  Warnings:

  - The primary key for the `candles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `type` on the `candles` table. The data in that column could be lost. The data in that column will be cast from `VarChar(5)` to `Enum(EnumId(3))`.
  - You are about to drop the `stock_histories` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `listing_price` to the `stocks` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `stock_histories` DROP FOREIGN KEY `stock_histories_stock_id_fkey`;

-- AlterTable
ALTER TABLE `candles` DROP PRIMARY KEY,
    MODIFY `type` ENUM('1m', '5m', '15m', '30m', '1h', '1d') NOT NULL,
    ADD PRIMARY KEY (`stock_id`, `candle_time`, `type`);

-- AlterTable
ALTER TABLE `stocks` ADD COLUMN `listing_price` BIGINT UNSIGNED NOT NULL;

-- DropTable
DROP TABLE `stock_histories`;
