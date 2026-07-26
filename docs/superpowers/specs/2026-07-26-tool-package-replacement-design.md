# Tool Package Replacement and Upload Feedback Design

## Goals

Improve software-package editing in the admin download center:

1. After an edit successfully switches to a new package, remove the old
   unreferenced package and its metadata.
2. Refresh the detected software version and actual file size after every new
   package upload.
3. Keep a visible upload-success state in the drop zone with the original
   filename, size, and detected version.

## Safe Replacement

The service captures the current `local_file_url` before updating the database.
After the database update succeeds, it compares the old and new URLs.

- If the URL did not change, no file operation occurs.
- If the old URL is not a managed `/uploads/tools/files/` URL, it is never
  deleted.
- If another software row still references the old URL, it is preserved.
- Otherwise the old package and its adjacent `.meta.json` are removed.
- A failed database update never deletes the old package.

The repository provides a narrow reference-count query. Filesystem deletion is
implemented in the upload utility with strict path validation so callers cannot
delete outside the managed tools directory.

## Admin Filename Metadata

`ToolDownloadItem` gains an optional admin-only `local_file_name` field.
Admin list, create, and update responses enrich package-backed items by reading
the existing upload metadata. Public page queries remain unchanged.

The edit form stores `local_file_name` separately from `local_file_url`:

- Opening an existing item shows the original uploaded filename when metadata
  exists and falls back to the stored basename otherwise.
- Completing a new upload immediately stores the browser filename returned by
  the upload API.
- The filename is UI metadata and is not accepted as a filesystem path.

## Automatic Field Refresh

After a package upload:

- `file_size_label` always uses the server response for the new file.
- `version` uses the version inferred from the new filename when inference
  succeeds.
- If no version can be inferred, the existing version remains unchanged so a
  valid value is not erased.
- Existing name, slug, description, and official URL behavior remains intact.

## Upload Success UI

The drop zone continues to show its normal upload affordance. When a package is
selected or uploaded, a persistent success panel appears inside the drop zone:

- check icon and “安装包上传成功”;
- original filename;
- current file size;
- detected/current version.

The temporary progress bar may disappear after completion, but the success
panel remains until the form is reset, another package replaces it, or editing
ends.

## Failure Behavior

- Upload failure leaves the current form and current package reference intact.
- Save failure leaves the old package intact.
- Old-file cleanup runs only after the new reference is committed.
- Filesystem cleanup errors are logged without rolling back a database update
  that has already succeeded; this avoids telling the administrator that the
  new package failed to save when only cleanup failed.

## Verification

- Repository tests cover reference counting.
- Upload utility tests cover safe deletion of the package and metadata.
- Service tests cover replacement cleanup, shared-reference preservation,
  failed-update preservation, and admin filename enrichment.
- Admin source tests cover automatic version/size replacement and persistent
  filename feedback.
- Focused tests, the complete backend suite, TypeScript linting, and the
  production build must pass.
