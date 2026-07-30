# News List Navigation State Design

## Problem

The news list stores its keyword, status, category, and page only in local React
state. Opening an article unmounts the list, and the editor's `返回列表` action
navigates to `/admin/news` without any list context. Returning therefore creates
a fresh list on page one with default filters, regardless of whether the article
was saved.

## Decision

Make the URL query string the source of truth for news list navigation state,
following the existing airport-list pattern.

Supported parameters:

- `keyword`: trimmed title or slug search text;
- `status`: `draft`, `published`, or `archived`;
- `category`: an active category slug;
- `page`: a positive integer greater than one.

Default values are omitted from the URL. Invalid values fall back to the default
list state.

## List Behavior

`NewsListPage` receives the current route search string and parses it into its
list state.

- Typing a keyword immediately updates the URL with history replacement, so
  refresh restores the search without creating one browser-history entry per
  keystroke.
- Changing status or category resets the page to one and pushes the normalized
  list URL.
- Pagination pushes the new page URL.
- URL changes from browser back or forward rehydrate the controls and trigger
  the matching list request.
- Existing fetching, deletion, topic quick edit, and empty-state behavior remain
  unchanged.

## Editor Navigation

Opening an existing article or creating a new one appends the current list query
string to the editor URL.

Examples:

```text
/admin/news/42?status=published&page=3
/admin/news/new?keyword=USDT&category=guide&page=2
```

The editor treats these parameters only as return context:

- saving or publishing an existing article does not remove them;
- after a new draft receives an ID, navigation to its permanent editor URL keeps
  them;
- `返回列表` navigates to `/admin/news` plus the preserved query string;
- returning without saving behaves identically;
- opening an editor directly without list parameters returns to the default news
  list.

## History Semantics

`AdminApp` exposes both push and replace navigation operations.

- Push is used for meaningful transitions such as filters, pagination, opening
  an editor, and returning to the list.
- Replace is used only for keyword typing to avoid noisy history.
- Both operations update the app's pathname and search state so UI rendering
  stays synchronized with `window.history`.

## Compatibility

The backend news-list API contract does not change. The UI converts validated
URL state into the existing `page`, `keyword`, `status`, and `category` request
parameters.

The topic-management panel has no editor-return flow and remains outside this
URL-state contract.

## Error Handling

- Non-positive or non-integer pages resolve to page one.
- Unknown statuses resolve to `all`.
- Empty keyword and category values resolve to their default filters.
- If a previously valid page exceeds the new result count after data changes,
  the list clamps to the last available page and normalizes the URL.

## Testing

- Unit-test query parsing and normalized URL construction.
- Add an admin navigation source regression proving list queries are carried
  into new/edit routes and restored by `返回列表`.
- Test that keyword changes use replace navigation while filters and pagination
  use push navigation.
- Run the focused news UI tests, frontend TypeScript check, complete backend
  suite, and production build.

## Out of Scope

- Preserving scroll position within the list.
- Preserving an open inline topic selector.
- Adding new news filters.
- Changing unsaved-editor confirmation behavior.
