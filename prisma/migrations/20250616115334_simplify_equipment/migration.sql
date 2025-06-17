/*
  Warnings:

  - You are about to drop the column `location` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `purchaseDate` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `serialNumber` on the `equipment` table. All the data in the column will be lost.
  - You are about to drop the column `warrantyExpiry` on the `equipment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "equipment" DROP COLUMN "location",
DROP COLUMN "model",
DROP COLUMN "purchaseDate",
DROP COLUMN "serialNumber",
DROP COLUMN "warrantyExpiry";
