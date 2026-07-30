# Icons8 Icon Migration — Design

## Goal

Replace the emoji characters currently used as UI icons across the NovaClass frontend with icons from [icons8.com](https://icons8.com), for a more consistent, professional icon system.

## Scope

**In scope:** every pictographic emoji used as a UI icon in:

- `src/components/Sidebar.jsx` — nav icons (dashboard, classroom, kmate, exam, settings)
- `src/pages/victoria/Dashboard.jsx` — search icon, stat card icons, tool card icons
- `src/components/NovaAssistant.jsx` / `src/pages/victoria/KMate.jsx` — attachment type icons (image/audio/file/fallback)
- `src/pages/victoria/Exam.jsx` — hero icon, feature icons, loading icon, result icons, back/settings icons
- `src/pages/victoria/Login.jsx` — input field icons, password eye toggle, decorative icons, status icons
- `src/pages/victoria/ClassDetail.jsx` — section header icons, file-type icons, feature card icons, attendance status icons, level badge icons
- `src/pages/victoria/Classroom.jsx` — section label icons
- `src/pages/victoria/Settings.jsx` — section/status icons
- `src/pages/victoria/MaterialPreview.jsx` — warning/file icons
- `src/components/PdfLessonViewer.jsx` — smart-highlight indicator icon

Roughly 60 icon instances total.

**Explicitly out of scope** (identified during exploration, deliberately not touched):

- `public/favicon.svg` — a custom-designed NovaClass logo mark (not a placeholder), stays as-is.
- `public/icons.svg` — an unused Bluesky brand-icon sprite, not referenced anywhere in `src/`. Dead code.
- Plain typographic arrows (`←` `→`) used for pagination/back buttons — text glyphs, not pictographic icons.
- The two `🤖` emoji inside `i18n.js` translation strings (`aiCheckBtn` / `aiChecking`) — confirmed unreferenced by any component currently rendered.
- Backend (`nova-class-backend`) — no icon usage exists there; it's an API service.
- Unrelated files already modified and uncommitted at the start of this work (`googleVision.js`, `PdfLessonViewer.css`, `googleVision.service.test.js`) — left untouched.

## Approach

### Shared `Icon` component

A new `src/components/Icon.jsx` centralizes the Icons8 CDN URL construction (hotlinking, per user preference — no downloads, no self-hosting):

```jsx
const CDN_SIZES = [32, 48, 64, 96, 128];

export default function Icon({ name, size = 20, alt = "", style }) {
  const cdnSize = CDN_SIZES.find(s => s >= size) ?? CDN_SIZES.at(-1);
  return (
    <img
      src={`https://img.icons8.com/fluency/${cdnSize}/${name}.png`}
      width={size}
      height={size}
      alt={alt}
      loading="lazy"
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    />
  );
}
```

- `name` — an Icons8 icon slug (e.g. `graduation-cap`, `bot`, `settings`, `chat`, `quiz`, `checkmark-yes`, `cancel`, `warning-shield`, `lock`, `mail`, `eye`, `pdf`, `image`).
- `size` — requested render size in px; resolved up to the nearest Icons8-supported CDN asset size so icons stay crisp.
- `alt` — empty string for decorative icons that sit next to a text label (e.g. nav items where `t(item.key)` already provides the label); a short descriptive string for icons that are the only content (e.g. the password visibility toggle, a standalone warning icon).

This is the single place that knows about the Icons8 URL pattern and style, so a future style/provider change is a one-file edit instead of a 10-file find-and-replace.

### Per-file migration

In each in-scope file, replace the emoji literal (usually stored in a `{ icon: "🎓", ... }`-shaped object or inlined in JSX) with an Icons8 slug string, and change the render site from a bare `<span>{icon}</span>` (or inline emoji in JSX) to `<Icon name={icon} size={N} alt="..." />`, preserving the existing pixel size implied by the current `fontSize` styling (e.g. `fontSize: "24px"` → `size={24}`).

Where an emoji currently sits inline in a JSX string, it's pulled out into an adjacent `<Icon>` element.

### Attribution

Icons8's free tier requires a visible attribution link. A small, muted "Icons by Icons8" credit + link is added to `Sidebar.jsx`'s bottom section, just below the logout button. Since `Sidebar` renders on every authenticated page (all routes except `/login` and the `MaterialPreview` overlay), this satisfies the attribution requirement app-wide with a single addition.

## Verification

- `npm run lint` in `nova-class-frontend` to catch unused imports/syntax issues from the sweep.
- Start the dev server (`npm run dev`) and visually check:
  - Sidebar nav icons render on any page.
  - **`http://localhost:5173/classroom/6`** specifically — this is `ClassDetail.jsx`, the page with the richest icon set (section headers, file-type badges, feature cards, attendance status glyphs, level badges) — confirm every icon renders correctly, at the right size, and aligned with adjacent text.
  - Login page (icons render before authentication, different code path).
  - The footer attribution link is visible and links to icons8.com.

## Risks / trade-offs (accepted per user decision)

- **Hotlinking dependency:** icons are fetched live from `img.icons8.com` at render time. If Icons8's CDN is down or the user is offline, icons won't render (alt text / broken-image box will show instead). Accepted trade-off for zero-setup simplicity.
- **Free-tier attribution:** required as long as no paid Icons8 plan is in place; the footer link handles this.
