# Accessibility plan

Maps features to the standards (§5), Game Accessibility Guidelines (GAG) and WCAG 2.1 AA for the HTML layer. Automated checks are axe-core in `tests/a11y.spec.js` (zero critical/serious in every major state, in 3D mode, text mode and high contrast). Full WCAG validation needs manual testing with assistive technologies and an expert review, which has **not** been done (see evaluation/METHODS.md).

| Feature | Where | Guideline |
|---|---|---|
| All UI is semantic HTML over the canvas (panel, tool pad, dialogs) | `src/ui/*` | WCAG 1.3.1, 4.1.2 |
| **Text mode with parity**: same chapters, same findings, same classify/sourcing/pin/verdict/label decisions; photos (6 standard views, 2 raking-light views, a close-up per finding) with alt text; audio-description-style descriptions; transcriptions of visible numbers; record measurements | `case-view.js` (`isText`), `content/text-mode/descriptions.json` | Standards §5.2; GAG "provide an alternative to 3D" |
| Keyboard play: every task works with the keyboard alone; points-of-interest list for every hotspot; preset measurement (longest side) in place of two-point picking | panel + `keymap.js` | WCAG 2.1.1; standards §5.3 |
| Visible, **remappable** key bindings (Menu → Controls and keys) | `ui/help.js` | GAG "allow controls to be remapped" |
| Pointer alternatives: on-screen buttons for turn/tilt/zoom, presets, flip; sliders for the raking light; lens buttons for the magnifier | `ui/tool-pad.js` | WCAG 2.5.1 |
| No drag-only interactions: the evidence board uses labelled `<select>`s | `case-board.js` | WCAG 2.5.1 |
| Live announcements: tool state, camera moves, findings recorded, measurements | `a11y/announcer.js` | WCAG 4.1.3 |
| Reduced motion: follows `prefers-reduced-motion` plus an in-game toggle; cinematics become stills; no decorative motion anywhere | `a11y/motion.js`, shot player | Standards §5.6; WCAG 2.3.3 |
| No flashing | — | WCAG 2.3.1 |
| Pause anywhere / no time pressure: nothing is timed | — | WCAG 2.2.2 |
| Captions and audio description for cinematics; the game has no audio | `content/cinematics.json` | WCAG 1.2.x |
| Cues never rely on colour alone: badges carry symbols and text ("◆ Real…", "✎ Fictional…"); feedback carries ✓ / ! / ✗ plus words | `site.css` | WCAG 1.4.1 |
| Text size (3 levels) and high-contrast settings; light/dark follows the OS | Settings | WCAG 1.4.3, 1.4.4 |
| Comfort: field-of-view setting; camera moves only on input (no acceleration) | Settings | Standards §5.12 |
| Focus management: dialogs trap and restore focus; chapter changes move focus to the panel; skip link to the case file | `a11y/focus.js` | WCAG 2.4.3 |
| WebGL unavailable → message plus text mode on automatically | `app.js` | Standards §6 |

## Documented limitation
In text mode, some visual discoveries become described facts: the catalog numbers are transcribed once the learner chooses the right "look" action. This lowers the discovery challenge. The reasoning challenge is unchanged: which tool, observation vs inference, sourcing, corroboration, verdict and calibration, and label writing. The magnifier lens itself is decorative for screen-reader users, so its findings are reached through the points-of-interest list.
