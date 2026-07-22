# PDF Arrow Navigation Design

## Goal

Allow users to move between pages in the controlled lesson PDF viewer using the keyboard without breaking normal scrolling or form interaction.

## Selected behavior

- `ArrowLeft` moves to the previous PDF page.
- `ArrowRight` moves to the next PDF page.
- `ArrowUp` and `ArrowDown` keep their native scrolling behavior.
- Navigation remains within page 1 and the loaded page count.
- The shortcut is active only while the PDF viewer is mounted.
- The shortcut is ignored when focus is in an input, textarea, select, or content-editable element.
- The shortcut is ignored while the saved-page dialog is open.
- Modified key combinations using Command, Control, Alt, or Shift are ignored.
- Handled left/right presses prevent browser horizontal scrolling.

## Alternatives considered

- Map all four arrow keys to page navigation: faster in theory, but removes expected vertical scrolling for tall PDF pages.
- Require focus on the PDF canvas: avoids global interception, but makes the shortcut difficult to discover and unreliable after toolbar interaction.
- Listen while the viewer is mounted and protect interactive contexts: predictable throughout the preview and preserves inputs and scrolling. This is the selected approach.

## Accessibility

Previous and next buttons expose `aria-keyshortcuts` values so assistive technology can announce the available shortcuts. Existing button controls remain available for users who do not use a keyboard.

## Testing

- Right arrow advances one page.
- Left arrow returns one page.
- Navigation clamps at the first and last pages.
- Up/down arrows are not intercepted.
- Arrow keys are ignored in the page input and while the saved-page dialog is open.
- Event listeners are removed when the viewer unmounts.

## Scope

This change adds keyboard page navigation only. Zoom, rotation, and additional keyboard shortcuts are outside scope.
