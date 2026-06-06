# Rubric — Country hover mini-dashboard (phase-b)

## Deterministic gates (binary — all must pass)
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` clean (strict)
- [ ] `npm run lint` clean
- [ ] `npm run smoke` passes (API routes still serve)
- [ ] No new runtime console errors on the console page

## Runtime gate
- [ ] Hovering a country hotspot opens the floating panel anchored near the dot
- [ ] Loading animation is visible before data resolves
- [ ] Panel populates with real per-country numbers; `Total sessions` matches
      that country's `/api/geo` count
- [ ] Mouse-leave closes the panel; re-hover (cached) shows no loader re-flash
- [ ] `prefers-reduced-motion` disables the open animation

## Visual review (screenshot via scripts/verify-ui.mjs)
- [ ] Panel matches the dark mono console aesthetic (tokens, Geist Mono,
      tabular-nums), readable, not clipped at viewport edges
- [ ] Open transition reads as smooth (fade/scale), not a hard pop

## Rubric scores (0–5; thresholds to pass)
| Dimension | Threshold |
|---|---|
| Correctness (real per-country data, matches /api/geo) | ≥ 4 |
| Interaction (hover open/close, cache, no stale-state leak) | ≥ 4 |
| Motion quality (smooth open + loader, reduced-motion honored) | ≥ 4 |
| Visual consistency with existing console | ≥ 4 |
| Code quality (surgical, no new deps, error state handled) | ≥ 4 |

**Pass = all deterministic + runtime gates green AND every rubric dimension ≥ its threshold.**
