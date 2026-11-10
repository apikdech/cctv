# Saved wall

## Intent

Keep a user's chosen wall cameras and their order across visits in the same browser, without requiring an account or a Save button.

## Behavior

- Automatically save camera IDs in localStorage after adding, removing, or reordering cameras.
- On a normal visit, restore the saved selection after the camera catalogue loads, but show the map with the existing **Wall (N)** button. Do not open the wall automatically.
- Existing valid shared wall links continue to open the linked wall; their camera selection replaces the saved wall.
- Add a **Clear wall** button to the wall header. It removes all selected cameras and the saved wall, closes the wall, and returns to the map. Other saved preferences remain untouched.
- Preserve existing map/camera navigation and wall-link behavior.

## Constraints and failure behavior

- Store only camera IDs, never streams or playback state.
- Restore only known, unique camera IDs in their saved order, up to the existing eight-camera limit.
- Invalid saved data is treated as an empty wall. Unavailable or full storage must not break in-memory wall use.

## Approaches

- **Automatic localStorage persistence (chosen):** saves each change immediately, works across visits on the same browser, and requires no backend.
- **Manual saving:** adds an unnecessary user action and risks losing unsaved changes.
- **Account-backed storage:** enables cross-device persistence but introduces authentication and backend work outside this request.

The user chose automatic saving and restoring the map with a saved **Wall (N)** button.

## Non-goals

No cross-device sync, multiple named walls, confirmation dialog, playback persistence, or changes to existing theme and panel preferences. Clear is immediate; confirmation was not requested.

## Implementation and verification

Follow the existing storage-helper and Svelte component patterns. Cover saved-data validation, storage failures, add/remove/reorder persistence, URL precedence, map-first restoration, and clearing across a remount. Run frontend tests, type checks, and production build.

## Approval

- [x] User selected automatic localStorage persistence.
- [x] User approved this design.
- [x] Implementation plan written.
- [x] Implementation verified.
