/*
  Warnings:

  - Added the required column `input` to the `Job` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "input" TEXT NOT NULL;
