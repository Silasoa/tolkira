# Design

## Data flow

`hash` -> `revealHash` -> open the target details -> `syncScrollPadding()` ->
`scrollIntoView()`

- On load: `showView('report')`, `syncScrollPadding()`, `revealHash()`.
- On `hashchange`: `revealHash()` re-measures before it scrolls.
- `syncScrollPadding` reads `.topbar.getBoundingClientRect().height`, rounds it
  up and sets `document.documentElement.style.scrollPaddingTop` to that height
  plus 8 px.

## Hard parts

A fixed em value cannot follow a bar that wraps to three rows only for wider
fallback fonts at 200 % text. The font stack and the text zoom are runtime
inputs; CSS has no way to measure them. The page already ships a small client
script, so one measurement there is cheaper than a layout-sensitive CSS ladder.

The measurement runs after the view switch and before the scroll, so it sees
the bar the user sees. It runs on every hash change. A pure window resize does
not re-measure, but native resize keeps the document position instead of
re-anchoring, so it does not re-hide a target.

## Contract

- Offset: `ceil(topbar height) + 8` px on the root element.
- Fallback: the existing CSS `scroll-padding-top` values remain for no-JS.
- Budget: client bundle 15,438 B of 16,000 B (562 B headroom).
- The 170 B delta is the only change to a no-history default document against
  0.5.1.
- The existing report-rendering requirement "an anchored scenario is not hidden
  behind the sticky bar" is the acceptance source; this change adds the
  cross-viewport statement.

## Risks

- A very late font swap could change the bar height after load; the browser
  keeps the document position in that case and the next hash navigation
  re-measures. Accepted.
- A host that blocks the client script keeps the CSS fallback; that is the
  documented no-JS state.
- The 562 B headroom is smaller than before. The build fails above 16,000 B, so
  further growth is caught.
