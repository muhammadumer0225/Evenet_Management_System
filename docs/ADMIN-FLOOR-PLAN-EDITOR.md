# Admin Floor Plan Editor

The Admin Dashboard > Floor plan & booths screen includes an interactive visual editor for the selected Expo.

## Editing booth positions

- Drag a booth to move it around the canvas.
- Drag the small handle at the booth's lower-right corner to resize it.
- Drag an empty area of the canvas to pan the view.
- Use the plus/minus controls to zoom and Reset to restore the default view.
- A booth's geometry is saved automatically when the pointer is released.

## Data and compatibility

The editor stores normalized percentage coordinates in the existing `Booth.position` object (`x`, `y`, `width`, `height`, and `rotation`). The existing authenticated admin `PUT /api/booths/:id` endpoint is reused; no new database collection or migration is required. Booth status, exhibitor assignment, pricing, size, and zone are sent unchanged with the position update. The existing booth update endpoint emits its Expo-scoped real-time update after persistence.

The public Expo and exhibitor floor-plan views use saved coordinates when present. Booths without saved coordinates continue to use the existing grid fallback. The existing floor-plan background image configured on the Expo is shown behind the editor canvas.

## Verification

Frontend unit/contract suite: `npm run test:unit`.

Before release, also verify in a browser using an admin account: move an available booth, resize it, refresh the page, and confirm the position and dimensions persist. Repeat with a reserved/occupied booth to confirm its status and exhibitor assignment remain unchanged. Verify the public Expo and exhibitor views still render the saved booth positions.
