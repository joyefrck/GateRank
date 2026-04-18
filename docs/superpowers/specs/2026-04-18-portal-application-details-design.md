# Portal Application Details Design

## Goal

Upgrade the applicant portal so it shows the full airport application details and allows the applicant to edit their own submission before payment is completed.

## Current State

- `GET /api/v1/portal/me` already returns the full `application` record.
- The portal UI only exposes a small subset of fields.
- There is no applicant-facing update endpoint for application details.
- Business rule confirmed in chat: before payment, the applicant can edit their own submitted information, including test account and test password.

## Requirements

### Portal visibility

The applicant portal must display the submitted airport information, including:

- airport name
- website list
- monthly price
- trial support
- subscription URL
- applicant email
- applicant Telegram
- founded date
- airport intro
- test account
- test password

### Edit rule

- When `payment_status = unpaid`, the applicant can edit and save their application data.
- When `payment_status = paid`, the application data is read-only.
- Read-only enforcement must exist on the backend, not only in the frontend.

### Existing portal flow

- The first-login password-change flow remains unchanged except for the already approved success-and-return-to-login behavior.
- Payment creation remains in the applicant portal.
- After saving application data, the portal should stay on the same page and refresh the visible application data.

## Backend Design

### Repository

Add an applicant-safe update method to `AirportApplicationRepository` that only updates editable business fields:

- `name`
- `website`
- `websites_json`
- `plan_price_month`
- `has_trial`
- `subscription_url`
- `applicant_email`
- `applicant_telegram`
- `founded_on`
- `airport_intro`
- `test_account`
- `test_password`

It must not update:

- `review_status`
- `payment_status`
- `payment_amount`
- `paid_at`
- `review_note`
- `reviewed_by`
- `reviewed_at`

### Portal route

Add `PATCH /api/v1/portal/application`.

Route behavior:

1. authenticate current applicant
2. load applicant account and linked application
3. reject updates when `payment_status = paid`
4. validate payload using the same shape used by the public application flow where applicable
5. persist updates
6. return refreshed `buildPortalView(...)`

### Validation

Use existing route validation style and keep the rules explicit:

- `name` non-empty
- `websites` array with at least one valid non-empty URL string
- `plan_price_month` non-negative number
- `has_trial` boolean
- `applicant_email` valid email
- `applicant_telegram` non-empty string
- `founded_on` valid `YYYY-MM-DD`
- `airport_intro` non-empty string
- `test_account` non-empty string
- `test_password` non-empty string
- `subscription_url` optional string

## Frontend Design

### Page structure

The portal page should be split into two clear blocks:

1. `申请进度`
   Shows current payment and review status, amount, payment actions, recent payment link.

2. `申请资料`
   Shows the submitted airport information in a denser card/form layout.

### Edit UX

- When unpaid, show an `编辑资料` / `保存资料` flow directly in the portal.
- When paid, render the same information in read-only format and show a lock message.
- The portal should not hide submitted information just because the applicant is still in the payment stage.

### Form behavior

- Initialize the portal edit form from `view.application`.
- Saving should call `PATCH /api/v1/portal/application`.
- On success, refresh `view` from the response and show a success message.
- Preserve the overall visual language already used by the portal page.

## Testing

### Backend

Add tests covering:

- unpaid applicant can update own application
- paid application cannot be updated
- returned portal payload contains updated values

### Frontend

Verification by build/typecheck is required.
The UI change should also be manually checked in the portal flow:

- unpaid state shows editable application details
- save succeeds and visible values refresh
- paid state shows read-only details

## Non-Goals

- No audit log for applicant self-edit in this change
- No history/versioning of applicant edits
- No partial field-level approval workflow
