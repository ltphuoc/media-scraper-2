/*
  Warnings:

  - A unique constraint covering the columns `[pageId,urlHash,type]` on the table `Media` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[urlHash]` on the table `Page` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `urlHash` to the `Media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `urlHash` to the `Page` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Media_pageId_url_type_key";

-- DropIndex
DROP INDEX "public"."Page_url_key";

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "urlHash" CHAR(32) NOT NULL;

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "urlHash" CHAR(32) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Media_pageId_urlHash_type_key" ON "Media"("pageId", "urlHash", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Page_urlHash_key" ON "Page"("urlHash");
