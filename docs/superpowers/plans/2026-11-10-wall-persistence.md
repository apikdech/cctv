# Saved Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically persist wall camera selection and order, restore it on the map, and provide a Clear wall button.

**Architecture:** Extend the existing wall helpers with defensive localStorage loading/saving. Explicitly save after wall mutations and valid hash imports; load once after the catalogue arrives, before applying the URL. A required Wall callback clears the selection, removes its saved key, and closes the overlay using existing navigation.

**Tech Stack:** Svelte 5, TypeScript, Vitest, Testing Library, pnpm; Node 26 from `web/.nvmrc`.

**Spec:** `docs/superpowers/specs/2026-11-10-wall-persistence-design.md`

## Global Constraints

- Store only camera IDs in localStorage; no new dependencies or backend.
- Restore known, unique IDs in order, up to the existing eight-camera limit.
- Revisit shows map and **Wall (N)**; valid shared links open and replace the saved wall.
- **Clear wall** is immediate and only removes wall data; preserve other preferences.
- Storage failures must not break in-memory use or navigation.

## Review Focus

- Missing or malformed JSON and non-array values must restore an empty selection (Task 1).
- Stale, duplicate, non-string, and excess IDs must be filtered without losing valid order (Task 1).
- Throwing reads/writes/removals must not crash the app (Tasks 1 and 2).
- Invalid wall links must not erase a previously saved wall; camera links must retain their navigation (Task 2).
- Removing the last camera or clearing after a camera-backed wall must persist emptiness without affecting theme/panel state (Task 3).

## Task 1: Storage helpers

**Files:** Modify `web/src/lib/wall.ts` and `web/src/lib/wall.test.ts`.

**Interfaces:** Export `WALL_KEY = 'cctv-wall'`, `loadWall(storage: Storage | null, cameras: Pick<Camera, 'id'>[]): string[]`, and `saveWall(storage: Storage | null, ids: string[]): void`.

- [ ] Add failing tests: round-trip `['b', 'a']` with catalogue `a,b`; null/missing/malformed/scalar/object data returns `[]`; unknown, duplicate and non-string array entries are discarded; ten known IDs restore only the first eight. Assert the exact key `cctv-wall`.
- [ ] Add failing tests: saving `[]` removes only `cctv-wall`; null storage and throwing getItem/setItem/removeItem are safe.
- [ ] Run `pnpm test -- src/lib/wall.test.ts` from `web` and confirm new tests fail on missing helpers.
- [ ] Implement the interfaces using JSON arrays, catalogue validation, existing `MAX_WALL`, and try/catch matching `theme.ts`; leave existing wall operations unchanged.
- [ ] Run the targeted tests and confirm all pass.
- [ ] Commit only Task 1 files with message `feat: add wall storage helpers`.

## Task 2: App persistence and restoration

**Files:** Modify `web/src/App.svelte` and `web/src/App.test.ts`.

**Interfaces:** Consume Task 1 helpers. No new component props in this task.

- [ ] Add failing integration tests: seed `cctv-wall` with `['kota-2','kota-1']`, render App, assert **Wall (2)** and no grid; open it and assert hash `#wall=kota-2,kota-1` and tile CSS order. Seed a saved wall alongside `#cam=kota-3` and assert that camera opens while **Wall (2)** remains available.
- [ ] Add failing tests: valid `#wall=kota-3` overrides and saves an older selection on initial load and hashchange; invalid `#wall=nope` removes the bad hash but retains saved selection without opening the grid.
- [ ] Add failing tests: adding saves `['kota-1']`; removing saves remaining IDs; drag/drop swaps persist their order; returning to map does not clear storage. Unmount, remove the URL hash, remount, and verify the last saved selection survives. A throwing localStorage getter still permits adding/opening a wall.
- [ ] Run `pnpm test -- src/App.test.ts` and confirm the new persistence expectations fail.
- [ ] Load saved IDs immediately after catalogue loading, before `syncFromHash()`. Call `saveWall` after successful add/remove/swap and valid wall hash import. Avoid a reactive save that could overwrite storage during initial empty state.
- [ ] Run `pnpm test -- src/App.test.ts src/lib/wall.test.ts` and confirm all pass.
- [ ] Commit only Task 2 files with message `feat: restore and autosave camera walls`.

## Task 3: Clear wall and final verification

**Files:** Modify `web/src/components/Wall.svelte`, `web/src/components/Wall.test.ts`, `web/src/App.svelte`, and `web/src/App.test.ts`.

**Interfaces:** Add required `onclear: () => void` Wall prop. App provides `clearWall(): void` that sets IDs to `[]`, saves emptiness, and calls `closeWall()`.

- [ ] Add failing Wall test: clicking the accessible **Clear wall** button calls `onclear` once without calling `onclose` or `onremove`; add `onclear: vi.fn()` to shared test props.
- [ ] Add failing App tests: clear a linked wall and a wall opened from a selected camera, assert no grid/no Wall button/no saved key and correct map or camera URL. Seed theme and panel preferences and assert they survive. Unmount/remount at `/` and assert the cleared wall stays gone. Removing the final tile must also delete the key and close the wall.
- [ ] Run `pnpm test -- src/components/Wall.test.ts src/App.test.ts` and confirm the new clear expectations fail.
- [ ] Add a header button labeled **Clear wall**, matching the existing compact dark-header style and aligned opposite map/count. Wire the callback and implement `clearWall` using Task 1 helpers and existing close navigation.
- [ ] Run `pnpm test`, `pnpm check`, and `pnpm build` from `web`; expect all tests passing, zero check errors, and successful build. Before Node commands, source nvm if necessary and run `nvm use` in `web`.
- [ ] Review the diff against the spec, including error paths and URL precedence; fix any gaps and rerun affected checks.
- [ ] Mark spec/plan checkboxes complete and commit only feature files/docs with message `feat: add clear wall action`.
