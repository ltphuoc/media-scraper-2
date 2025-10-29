/*
  Warnings:

  - A unique constraint covering the columns `[pageId,type,urlHash]` on the table `Media` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Media_pageId_urlHash_type_key";

-- AlterTable
ALTER TABLE "Media" ALTER COLUMN "urlHash" SET DATA TYPE CHAR(64);

-- AlterTable
ALTER TABLE "Page" ALTER COLUMN "urlHash" SET DATA TYPE CHAR(64);

-- CreateIndex
CREATE INDEX "Media_urlHash_idx" ON "Media"("urlHash");

-- CreateIndex
CREATE UNIQUE INDEX "Media_pageId_type_urlHash_key" ON "Media"("pageId", "type", "urlHash");
