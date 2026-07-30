# News Single-Topic Quick Edit Design

## Problem

The news list shows article status, publication time, update time, and the
full-editor action, but it does not show an article's topic. Operators must open
the full article editor to inspect or change that association.

The current article model, editor, mutation API, and join table also allow
multiple topics. The new product rule is:

- an article may have no topic;
- an article may have one topic;
- an article must never have more than one topic.

The existing full article editor remains available.

## Decision

Keep `news_article_topics` as the storage model and preserve the existing
`topics: NewsTopicSummary[]` response shape for public and admin consumers.
Enforce a maximum of one topic at the admin UI, mutation service, repository
schema, and data-migration boundaries.

This avoids a wide `news_articles.topic_id` migration while making the
single-topic rule authoritative beyond the browser.

## News List Interaction

Add a `专题` column immediately to the right of `更新时间` and before `操作`.

- When an article has a topic, show its name as a compact neutral chip.
- When an article has no topic, show `未设置` in muted text.
- Show a small pencil button beside the current value.
- Clicking the pencil replaces the display with a single-select control.
- The select contains `无专题` followed by all active topics.
- Selecting an option saves immediately through the existing article mutation
  API; no separate confirmation button is required.
- While saving, disable the row control and show an in-progress state.
- On success, update the row's topic and `updated_at` values from the returned
  article without navigating away or reloading the full list.
- On failure, restore the previous displayed value, keep the editor available
  for retry, and show the existing list-level error message.
- Clicking outside the selector or pressing Escape before choosing a different
  value closes it without saving.
- The original article title link, `编辑` button, and draft/archive deletion
  behavior remain unchanged.

Only one row may be in topic-edit mode at a time. Starting another row's edit
closes the previous selector.

## Full Article Editor

Replace the existing topic checkbox group with a single-select control.

- `无专题` maps to `topic_ids: []`.
- A selected topic maps to `topic_ids: [topicId]`.
- Loading an existing article selects its only associated topic.
- The editor must not silently preserve a second historical association after
  the schema migration has normalized existing data.

## API and Service Contract

Continue accepting `topic_ids` and `topic_slugs` for compatibility, but validate
that the resolved list contains at most one unique positive topic.

- Empty arrays clear the association.
- A one-item array sets the association.
- Arrays that resolve to more than one unique topic return HTTP 400 with a
  clear single-topic validation message.
- Other partial article updates keep their current behavior.
- A topic-only update must touch `news_articles.updated_at`, so the list shows
  and sorts by the real time of the operational change.
- The response remains a hydrated article with `topics` containing zero or one
  item.

The existing `PATCH /api/v1/admin/news/:id` route is reused; no new endpoint is
needed.

## Data Compatibility and Constraint

Add a unique index on `news_article_topics(article_id)`.

Before creating the index on an existing installation, normalize historical
multi-topic rows deterministically:

1. rank associations for each article by active topic first;
2. then by `news_topics.sort_order`;
3. then by `news_topics.id`;
4. retain the first association and delete the rest.

This keeps the most relevant currently usable topic where possible. Articles
with no association remain valid.

Schema initialization must be idempotent: repeat startup checks leave the
normalized rows and unique index unchanged.

## Error Handling

- Client save failures use the existing API error message when available and
  otherwise fall back to `专题更新失败`.
- The row control is re-enabled after either success or failure.
- The server rejects multi-topic writes before repository mutation.
- The database unique index is the final guard against race conditions or
  future code paths that bypass service validation.

## Testing

- Add a source-level admin UI regression test for the new list column, inline
  selector, immediate `PATCH`, and preserved full-editor action.
- Add editor regression coverage proving the topic control is single-select and
  supports `无专题`.
- Add route/service coverage for clearing a topic, setting one topic, and
  rejecting multiple topics.
- Add repository coverage for historical association normalization, the unique
  index, and `updated_at` changes on topic-only updates.
- Run the focused news tests, backend typecheck, frontend typecheck/lint,
  complete backend test suite, and production build.

## Out of Scope

- Adding a topic filter to the news list.
- Creating, renaming, or archiving topics from the inline editor.
- Redesigning the full article editor or topic management panel.
- Changing public news response shapes or public topic URLs.
