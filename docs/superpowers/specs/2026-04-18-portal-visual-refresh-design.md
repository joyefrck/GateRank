# Portal Visual Refresh Design

## Goal

Upgrade the applicant portal from a sparse black-and-white utility page into a stronger external-facing product experience, while keeping the existing portal business flow intact.

The refreshed page should feel more polished, more colorful, and more trustworthy for applicants who are completing payment and tracking review progress.

## Current State

- The portal already supports login, first-time password change, payment order creation, and application detail display/editing.
- The current page layout is functional but visually flat:
  - heavy use of black/white neutrals
  - weak hierarchy between progress, payment, and application details
  - payment actions look like generic buttons instead of recognizable payment choices
- The applicant portal is an external user-facing page, so it should communicate stronger product quality than an internal admin-style layout.

## Confirmed Direction

The approved visual direction is the `B` option from brainstorming:

- blue-green product tone
- lighter, more modern SaaS-style presentation
- stronger emphasis on progress feedback and payment actions
- colored Alipay and WeChat payment surfaces with recognizable logos

## Requirements

### Visual language

The portal should adopt a lighter blue-green palette instead of relying on pure black as the dominant accent.

Requirements:

- use a soft blue/green gradient or atmospheric background treatment in the hero area
- keep the page bright and readable on desktop and mobile
- maintain strong contrast for important text and actions
- avoid turning the page into a dark dashboard or a generic admin panel

### Content hierarchy

The page should clearly separate three concerns:

1. applicant progress and current stage
2. payment amount and payment actions
3. submitted airport information

The layout should make it obvious what the applicant should do next without hiding the rest of their submitted information.

### Payment actions

The portal must show two distinct payment methods:

- Alipay
- WeChat Pay

Each method should have:

- a colored branded card/button treatment
- a recognizable logo or visual mark
- short helper copy describing the payment action

The existing payment creation logic stays unchanged in this design. This change is visual and structural, not a payment-flow rewrite.

### Application details

The previously approved applicant detail visibility and edit behavior remains in scope:

- before payment, details are editable
- after payment, details are read-only

The redesign must preserve this behavior while presenting the information in a more refined layout.

## Page Design

### Hero and frame

The top of the portal should become a branded header block rather than a plain title line.

It should include:

- the `GateRank Portal` label
- the main page title `申请人后台`
- a short explanatory sentence
- subtle decorative gradient/background treatment

The existing `返回首页` and `退出` actions should remain available in the header area, but visually integrated into the refreshed design.

### Progress overview

Add a more deliberate progress summary section near the top of the logged-in state.

This section should communicate:

- application id
- current status
- amount due or payment status
- whether the application can still be edited

Recommended treatment:

- compact status cards with clearer color coding
- a small progress/timeline cue that reinforces where the applicant is in the flow

### Payment section

The payment block should no longer look like a single plain white card with two neutral buttons.

It should become a dedicated payment surface with:

- clearer visual title and helper text
- stronger amount emphasis
- two side-by-side branded payment option cards on desktop
- stacked cards on smaller screens

Payment card intent:

- Alipay card uses blue branding
- WeChat card uses green branding
- cards remain obviously clickable and preserve loading/disabled states

If the gateway later returns channel-specific UI such as a QR payload for WeChat, this section should still be structurally suitable for rendering that result without another major layout rewrite.

### Application details section

The application details section should keep the complete airport information but present it with more hierarchy.

Recommended structure:

- section header with save/read-only state messaging
- grouped field layout with better card boundaries
- more visual distinction between summary metrics and detailed text fields

The design should avoid making all fields feel equally heavy. Core business facts such as airport name, website count, monthly price, trial support, and applicant email should feel more scannable than long-form introduction text.

## Component-Level Design

### Payment logos

Use inline SVG or equivalent local UI-safe rendering for:

- Alipay logo mark treatment
- WeChat Pay logo mark treatment

The logos do not need to be full official brand lockups with wordmarks if that complicates implementation; a clean recognizable icon treatment is sufficient for this iteration.

### Tone system

Use color intentionally:

- blue for Alipay-related UI
- green for WeChat-related UI
- teal/blue-green for general portal accenting
- amber only for warning or editable-state notices
- red only for errors

### Reusable portal surfaces

Introduce lightweight reusable portal visual primitives where helpful, such as:

- portal hero shell
- portal summary card
- branded payment method card
- grouped read-only/editable field container

This should reduce duplication inside `src/App.tsx` and make later portal polish easier.

## Behavioral Constraints

- Do not change portal authentication flow
- Do not change first-login password-change business rules
- Do not change payment order API shape
- Do not change applicant edit permissions
- Do not introduce new dependencies just for logos or styling

## Testing

### Functional verification

Verify the portal still supports:

- login
- first-time password change
- unpaid editable application view
- payment button loading state
- paid read-only application view

### Visual verification

Manually verify:

- desktop layout hierarchy
- mobile stacking and spacing
- payment cards remain readable and clickable
- colored surfaces still preserve contrast for text/icons

### Build verification

Run at minimum:

- `npm run lint`
- `npm run build`

## Non-Goals

- No payment provider SDK integration change
- No redesign of public landing pages outside the portal
- No applicant-side payment history center
- No animation-heavy marketing page treatment
