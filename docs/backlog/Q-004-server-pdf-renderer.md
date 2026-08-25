---
id: Q-004
type: question
title: Server-side PDF renderer, if one is ever needed
status: open
depends_on: []
refs:
  - docs/architecture/architect-overview.md#10.4
  - docs/architecture/architect-overview.md#6
  - docs/architecture/architect-overview.md#9
---

## Question

Puppeteer or `@react-pdf/renderer`, should server-side PDF generation become
necessary?

## Current default

Neither. Printing is `@media print` plus the browser's own "Save as PDF".

## Cost of changing later

Zero now — deferred together with the feature itself. Print consumes the same
domain functions as the UI, so swapping in a renderer does not touch the model.

## Needed from

Nobody yet. Re-open when the trigger in overview §9 fires: the application must
produce a file itself, or pagination beyond CSS is demanded.
