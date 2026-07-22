# PDF Zoom Design

## Goal

Allow users to enlarge and reduce lesson PDF pages while preserving existing page navigation, bookmarks, and overlay behavior.

## Controls

- Add decrease, current percentage, and increase controls to the PDF toolbar.
- Supported levels are 50%, 75%, 100%, 125%, 150%, 175%, and 200%.
- The percentage control resets zoom to 100%.
- Disable decrease at 50% and increase at 200%.
- Keep zoom unchanged when moving between pages.
- Let the existing PDF viewport scroll horizontally and vertically when an enlarged page exceeds the available area.

## Keyboard shortcuts

- `Control` or `Command` plus `+` increases zoom by one step.
- `Control` or `Command` plus `-` decreases zoom by one step.
- `Control` or `Command` plus `0` resets zoom to 100%.
- Ignore shortcuts while focus is in an input, textarea, select, or content-editable element.
- Ignore shortcuts while the saved-page dialog is open.
- Prevent the browser's own page zoom only when a supported PDF zoom shortcut is handled.

## Rendering

Keep the responsive base page width and apply the selected zoom factor through the PDF page renderer. This preserves fit-to-window behavior at 100% and enables scrolling above 100%.

## Accessibility

- Give every control a descriptive accessible label.
- Expose keyboard shortcuts using `aria-keyshortcuts`.
- Display the current percentage as visible text.
- Retain the existing focus-visible treatment and minimum touch target sizes.

## Testing

- Increase and decrease buttons change the rendered scale and displayed percentage.
- Controls clamp at 50% and 200%.
- Percentage control resets to 100%.
- Command/Control shortcuts increase, decrease, and reset.
- Unsupported, input-focused, and saved-dialog shortcuts are not intercepted.
- Existing arrow navigation and bookmark tests continue to pass.

## Scope

This change adds discrete PDF zoom only. Pinch gestures, free-form percentage entry, rotation, and fit-width modes are outside scope.
