/*
  Warnings:

  - The values [INVALID_REQUES] on the enum `transfers_reject_reason` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `transfers` MODIFY `reject_reason` ENUM('INSUFFICIENT_BALANCE', 'INVALID_RECIPIENT', 'SENDER_NOT_ACTIVE', 'RECIPIENT_NOT_ACTIVE', 'SELF_TRANSFER', 'INVALID_REQUEST') NULL;
