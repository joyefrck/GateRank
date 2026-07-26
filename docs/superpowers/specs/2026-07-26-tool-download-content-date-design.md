# Tool Download Content Date Design

## Problem

The public download cards currently display `updated_at` before `published_at`.
`tool_download_items.updated_at` is a generic MySQL timestamp with
`ON UPDATE CURRENT_TIMESTAMP`, so download-count increments and other unrelated
row writes refresh it. The date shown as “发布” can therefore become the last
download date instead of the date when an administrator updated the software.

## Decision

Add a nullable `content_updated_at` column dedicated to administrator content
edits.

- A newly published historical or current item displays `published_at`.
- A successful admin `PATCH /api/v1/admin/tools/downloads/:id` sets
  `content_updated_at` to the current Shanghai time.
- Publish/archive status actions and download-count increments do not set
  `content_updated_at`.
- Public metadata displays `content_updated_at || published_at`.
- Existing rows receive `NULL` through the compatible schema migration and
  therefore immediately fall back to their original `published_at`.
- The generic `updated_at` remains available for database bookkeeping but is no
  longer used as the public release date.

## Data Flow

1. `ToolDownloadRepository.ensureSchema()` adds
   `content_updated_at DATETIME NULL` to existing installations.
2. `ToolsDownloadService.updateDownload()` injects the current Shanghai SQL
   timestamp into the parsed admin update.
3. Repository reads expose the new field through `ToolDownloadItem`.
4. Shared rendering logic selects `content_updated_at` first and
   `published_at` second, keeping React and SSR output consistent.

## Compatibility

No destructive historical backfill is performed. Existing polluted
`updated_at` values are intentionally ignored because the application cannot
reliably distinguish past admin edits from download-count writes.

## Verification

- Shared metadata tests prove generic `updated_at` is ignored.
- Repository tests prove the schema and row mapping include the new field.
- Service tests prove admin edits stamp `content_updated_at`.
- Focused route and rendering tests, the complete backend suite, TypeScript
  linting, and the production build must pass.
