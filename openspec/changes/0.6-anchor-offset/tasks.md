# Tasks

## 1. Correction

- [x] 1.1 Reproduce the Linux failure: after task 3.5 the bar wraps to three
  rows at 320 px / 200 % text and the anchored target sits behind it.
  (2026-11-24, Linux CI run on the archived tree)
- [x] 1.2 Measure the rendered `.topbar` on load and hash change, set
  `scroll-padding-top` to height + 8 px before the scroll, and keep the CSS
  reserve as the no-JS fallback. (`dc15812`)
- [x] 1.3 Calibrate the Trends e2e: 50 % bar ceiling, target below the bar,
  region cap 70 vh, 4,000 px distance budget; keep the other assertions.
- [x] 1.4 Regenerate the golden HTML and characterization hashes; record the
  bundle at 15,438 B and update the live `DESIGN.md` claim.
- [x] 1.5 Gate: hygiene ok; typecheck, lint, build; 1,494 unit passed, 8
  skipped; e2e 424 passed, 8 skipped on Chromium, Firefox and WebKit; OpenSpec
  9 passed, 0 failed. (2026-11-24)
- [x] 1.6 Cross-engine CI green on Linux, Windows and macOS before release prep.
  (run 45385928115)
- [x] 1.7 Spec correction: restate the four archived byte claims and add the
  measured-offset requirement; no new code. (2026-11-24)

## 2. Release evidence

- [x] 2.1 Five required host rows on the release tarball (631,852 B, SHA-256
  `7946DF21...A928`); counts and statuses unchanged and the 170 B script delta
  present in every default report. The documentation-only repack (631,909 B,
  SHA-256 `97B5D2CF...1085`) passed the install smoke; the host rows ran on the
  same code. (2026-11-24)
- [ ] 2.2 Final release review and the user's approval of 0.6.0, including this
  correction.
