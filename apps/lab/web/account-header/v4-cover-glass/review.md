# Review — web/account-header/v4-cover-glass   (2026-11-22)

Independent review. Base: v3-passport-stamp (approved). Opened in the lab frame
(`http://127.0.0.1:7320/lab/frame-web.html#/account-header/v4-cover-glass?...`) with Playwright at 390 / 768 / 1440 ×
ar-RTL / en-LTR × light / dark, plus 640 / 700 / 900 / 1024 for the editor. Source read: `page.tsx`, `tokens.css` §5,
`parts/cover-hero.tsx`, `parts/side-card.tsx` (camera badge), `parts/image-editor/*`.

Main user task: personalise the account. Pick a ready cover or upload and crop one, change the profile photo, see the
result in context, save or remove it, and keep the account header readable.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 8 | The glass plate keeps the welcome title the clear focal point over every photo. The two camera controls are easy to find and don't compete with it. |
| Task flow & speed | 6 | Gallery pick → preview → save takes 3 actions and is clear. On phones and tablets the crop step has no usable zoom. |
| Layout & responsiveness | 5 | No page overflow at any width, but the zoom slider collapses to 0–4 px at 390 and 768. The hero also jumps 36–56 px when loading ends. |
| RTL / bilingual | 4 | The page is correctly mirrored. The whole cover editor body is forced to `dir="ltr"` in Arabic, which reverses the grid and tabs and breaks bidi text. |
| Accessibility | 6 | Measured contrast passes on all 9 photos. Focus trap, labels and live region are good. Focus is lost to `<body>` while saving or removing. |
| Visual craft & originality | 8 | Calm navy glass that matches the home hero's language, with no stripes or gradients. The avatar badge placement keeps the level marks whole. |
| Motion & feedback | 7 | Fade, rise and sheet respect reduced motion, and saving, error and remove states are explicit. A layout jump at load and a silent discard on Esc weaken it. |

## Blocking issues (must fix before approval)

### B1. The cover editor's tab content renders left-to-right in Arabic
- **Where:** `parts/image-editor/image-editor.tsx:447` (`<Tabs.Root value={tab} …>`), ar, every width and theme.
- **What:** Radix Tabs writes `dir="ltr"` on its root because no `dir` prop or `Direction.Provider` is given. Measured:
  `Tabs.Root[dir]="ltr"`, the fieldset's computed `direction: ltr`, and the presets laid out
  `makkah@589 … giza@1023` (first item on the **left**). Everything inside the tabs inherits it:
  - The tabs read Gallery-left, Upload-right.
  - The gallery grid runs left-to-right, so Makkah, the first and featured preset, sits bottom-of-mind on the left.
  - Arabic sentences get LTR bidi. The rules line renders as "JPEG أو PNG أو WebP، حتى 5 …" split, with the full stop
    at the start. Error alerts show ".أبعاد الصورة …" with the icon on the wrong side. The crop help reads ".للتدوير R
    اسحب …". Screenshots: `review/editor-upload-error-1440-rtl-light.png`,
    `review/editor-cover-crop-keyboard-1440-rtl-light.png`.
  - The zoom row runs label → slider → % left to right. Compare the avatar editor, which has no Tabs and is correct:
    `review/editor-avatar-crop-1440-rtl-light.png`.
  - Keyboard: in the gallery, ←/→ moves in LTR logic. In Arabic, ← on Istanbul goes to Makkah, which is visually to
    the right.
- **Why it matters:** Arabic is the primary language. The editor looks broken and the error messages are hard to read
  exactly when the user needs them. The README's RTL shots missed it.
- **Fix:** `<Tabs.Root dir={m.dir} …>`, or better, wrap the dialog content (it is portalled) in
  `<Direction.Provider dir={m.dir}>` so every Radix primitive inherits it. Also set `dir` on `Dialog.Content`. Re-shoot
  the RTL editor states.

### B2. The zoom slider collapses at 390 and 768 px, so phones cannot zoom
- **Where:** `parts/image-editor/cropper.tsx:161` (`flex min-w-0 flex-1` wrapper) and `:174` (`min-w-0 flex-1` range),
  inside `image-editor.tsx:306` (`flex flex-wrap` row with the Rotate and Another-photo buttons). Cover and avatar,
  both languages.
- **What:** Measured slider widths:
  - 390: 0 px (en and ar).
  - 768: 0 px (en) and 4 px (ar).
  - 640: 132 px. 900: 103 px.

  At 0 px the "100%" readout overlaps the "Rotate 90°" button (`review/editor-cover-crop-390-ltr-light.png`,
  `review/editor-cover-crop-768-ltr-dark.png`). The row doesn't wrap because the zoom group may shrink to 0 before
  flex-wrap kicks in. The cropper has no pinch gesture (`touch-none`, pointer drag and wheel only), so **a phone user
  has no way to zoom at all**.
- **Why it matters:** Cropping is half of the upload flow. A cover at 3:1 often needs zooming to keep a subject inside
  the phone guide.
- **Fix:** Give the zoom group its own line (`basis-full` below `md`), or set `min-w-[160px]` on the range so the row
  wraps. Add two-finger pinch to the stand-in, which react-easy-crop gives for free in the port. Optionally add −/+
  icon buttons (44 px) on either side of the slider for touch users.

### B3. Focus is dropped to `<body>` while saving or removing, and lands on the dialog container after a failure
- **Where:** `image-editor.tsx:524-537` (`disabled={!changed || saving}` on Save, `disabled={saving}` on Cancel) and
  `:495` (`disabled={saving}` on "Yes, remove"). Verified with the keyboard at 1440 and 390.
- **What:**
  - Pressing Save or Yes-remove disables the focused button, and `document.activeElement` becomes `BODY` while the
    modal is still open.
  - With `&save=fail`, focus then goes to the `role=dialog` container, which also draws a teal ring around the whole
    dialog (`review/editor-save-fail-1440-ltr-dark.png`). The next Tab starts again from Close, so retrying means
    tabbing through the whole dialog.
- **Why it matters:** Screen-reader users lose their place mid-operation inside a modal, and keyboard users must
  re-navigate after an error. WCAG 2.4.3 (focus order).
- **Fix:** Keep Save and Yes-remove focusable while busy, using `aria-disabled="true"` and ignoring clicks instead of
  `disabled`. They already show a spinner. On failure, keep or move focus to Save, or focus the alert with
  `tabIndex={-1}`.

## Improvements

Ranked by severity.

1. **The hero jumps when loading ends or a cover link expires** (major, CLS).
   - **Where:** `page.tsx:106-116`. The plate adds `px-5 py-4` and only exists when `shown`. `cover-hero.tsx:22` keeps
     `shown` false while `state==='loading'`.
   - **What:** Measured hero heights. At 1440: 237 px while loading, 273 px when ready with a cover. At 390: 197 →
     252 px. The side card and all content below move 36–56 px. An expired cover does the reverse after the preload's
     `onerror`.
   - **Why it matters:** This is a visible jump on every account page load for every customer who has a cover.
   - **Fix:** Reserve the same box in both modes. Either always render the plate wrapper (transparent, same padding,
     no glass) without a cover, or render the loading skeleton inside a plate-sized box when `customer.cover` is known
     to be set.
2. **The loading state labels the chip "Add a cover"** (minor, misleading). `cover-hero.tsx:62-68`: while loading,
   `shown` is false, so a customer who has a cover sees a disabled "Add a cover"
   (`review/state-loading-1440-ltr-dark.png`), which then flips to "Change cover". Show a chip-sized skeleton, or no
   label until the data is known.
3. **Escape or Cancel throws away a crop without asking** (medium).
   - **Where:** `image-editor.tsx:83-85`. After uploading and cropping, Esc, Close or a click outside closes at once,
     and the work is lost.
   - **Why it matters:** The web guidelines ask for a warning on unsaved changes.
   - **Fix:** When `changed` is true, show the same inline confirm pattern used for Remove ("Discard your changes?
     Keep editing / Discard") instead of closing.
4. **The crop guides don't match what the page actually shows** (medium).
   - **Where:** `crop.ts:24-27`.
   - **What:** The guides assume desktop ~4.8:1 (62 % of the height) and phone ~1.35:1 (45 % of the width). Measured
     cover bands:
     - 1440: 1425×337 (4.2:1), so 71 % of the height is visible.
     - 390: 375×316 (1.19:1), so 40 % of the width is visible.
     - 1920: about 5.7:1, so about 53 % of the height.

     The side card (from `lg`) and the plate also cover much of the band.
   - **Fix:** Derive the guides from the real band heights at 390 / 1280 / 1920, or show the desktop guide as a range
     with an inner and outer band. Label the phone guide "Phone (approx.)".
5. **The preview only shows the desktop shape** (medium). `previews.tsx:12` uses a fixed 2.4:1 mini hero. On the phone
   sheet, the real band is about 1.2:1 and mostly covered by the plate and the card. Add a second, phone-shaped
   thumbnail next to it, and on phones move the preview above the fold. Today it sits below 8 thumbnails, and the user
   has to scroll to see what they picked (`review/editor-cover-gallery-sheet-390-rtl-dark.png`).
6. **On phones the cover is barely visible** (medium, answers open question 3). At 390, about 60 px of photo shows
   above the plate and about 35 px below it before the side card (`review/390-ltr-dark.png`). At 768 the plate and the
   card hide most of it (`review/768-ltr-light.png`). Growing the mobile hero by about 40 px when a cover is set, as
   the README proposes, is worth it. Tightening the plate's padding below `sm` also helps (`px-4 py-3`).
7. **An uploaded cover can't be re-cropped** (minor). `image-editor.tsx:147-149` opens the Upload tab for an uploaded
   cover, but only the empty drop zone shows (`review/editor-cover-uploaded-768-ltr-dark.png`). Offer "Adjust current
   photo", which loads `current.url` into the cropper.
8. **Initial focus lands on Close** (minor). `image-editor.tsx:431`. Radix focuses the first tabbable element. For the
   cover editor, the checked gallery radio, or the active tab, is the better start. Use `onOpenAutoFocus` to focus it.
9. **The tab panels are an extra Tab stop** (minor). Radix's `Tabs.Content` adds `tabIndex=0`, so the keyboard path is
   tab → panel → first control. When the panel starts with a focusable control, pass `tabIndex={-1}` or `asChild`.
10. **The drop-zone copy on touch devices** (minor). `image-editor.tsx:346` always says "Drag and drop a photo here",
    even when `coarse` is true and the camera button shows. On touch, use "Choose a photo or take one".
11. **12 px text** (minor, owner's type scale). `text-xs` (12 px) is used for:
    - the gallery's "Current" (`image-editor.tsx:405`)
    - the crop guide labels (`cropper.tsx:138`)
    - the preview size captions (`previews.tsx:58,65`)

    It is not 13 px, but it is the smallest text on the page. Confirm with the owner, or move to 14 px. "Current"
    measures 4.55:1 in light, which is just AA.
12. **Double announcements on the slider** (minor). `cropper.tsx:172` sets `aria-valuetext`, and `updateCrop` also
    writes the zoom to the polite live region (`image-editor.tsx:215`). Slider users hear it twice. Announce through
    the live region only for key and wheel changes on the crop frame.
13. **The icon-only cover chip below 640 px has no visible label or tooltip** (minor). `cover-hero.tsx:79`. The
    accessible name is fine. Add `title={label}` as the avatar badge does, for sighted mouse users at tablet widths.
14. **The "Add a cover" outline is 14 % white on navy** (minor, WCAG 1.4.11 is not strictly required because the text
    identifies it). `cover-hero.tsx:74`. The button edge is hard to see (`review/state-no-cover-1440-rtl-light.png`).
    `--ah-on-brand-line` at 30 % or more would read better as a button.
15. **Owner-accepted trade-off, for the record:** Save (teal-500 with white text) measures 2.57:1 at 14 px bold in both
    themes. This is the site's primary colour rule, not a v4 regression, and the same applies to "My bookings".

## What is better than baseline

- v1-baseline has no account personalisation at all. The account header was flat. v4 adds a cover and photo flow in
  one consistent editor, with gallery, upload, crop, preview, remove and error states. Picking a preset takes 3
  actions: open, pick, save. The new cover shows at once, and "Cover saved" is announced.
- The glass header over a photo matches the language of the home hero in `v1-baseline/1440-rtl-light.png` (a photo
  with a translucent bar), so the account area now feels like the same product.
- **The contrast claim holds up when measured on the real photos.** I hid the text, captured the backgrounds behind
  it and took the brightest pixel. That covers 8 presets plus the upload sample, at 1440 ar/en, 768 ar and 390 ar/en,
  in dark mode.
  - Title (white): 7.7:1 or more.
  - Subtitle (navy-100): 6.3:1 or more.
  - Header nav (navy-200, 14 px): 5.1:1 or more. The worst case is Giza at 1440.
  - Camera chip: 6.8:1 or more.

  All pass AA, and the README's worst-case maths is conservative.
  (`review/contrast-worst-giza-1440-rtl-light.png`)
- There is no layout shift from the image itself: the photo is absolutely positioned and fades in. There is no page
  overflow at any of the 12 combinations: `scrollWidth == clientWidth`.
- The client checks work and are specific:
  - GIF: type message.
  - 6 MB: "6.0 MB, max 5".
  - Corrupt file: "could not read".
  - 120×90: shows the real size.

  Each is shown with `role="alert"`.
- Focus is trapped and returns to the opener after Save, Cancel or Esc. After Remove, it returns to the same chip, now
  "Add a cover". Saving blocks Esc. Remove asks first and autofocuses "Keep it".
- The avatar camera badge is a 44 px target with a 36 px disc at bottom-start, away from the level badge and the GOLD
  tail, with a visible focus ring (`review/focus-avatar-badge-1440-rtl-light.png`). The avatar preview at 128, 64, 32
  and 32-on-navy is a genuinely useful in-context check.
- All new controls are 44 px or more in the editor and on the page: Close, tabs, Choose, Rotate, Another, Remove,
  Cancel, Save, the chip and the badge.

## Test notes

- The Playwright window was throttled to about 2 animation frames per second, which made exit animations take
  0.6–2.6 s. Results that depended on timing (closing, preview refresh) were re-checked with
  `reducedMotion: 'reduce'` and longer waits. Esc, Cancel and Close all close correctly. Only the deterministic
  findings above are reported.
- Not verified: `prefers-reduced-transparency` (cannot be emulated), a real touch device (pinch, camera capture,
  `pointer: coarse` copy), and a screen reader's actual speech.
- Console: the only error is `https://files.invalid/a.webp` from the stamp sheet's deliberate "expired link" demo. It
  is not from v4 code.

## Screenshots

All in `review/`:

| File | Shows |
|---|---|
| `390-*`, `768-*`, `1440-*` (12) | Full viewport, GOLD, gallery cover (Istanbul), rtl/ltr × light/dark |
| `contrast-worst-giza-1440-rtl-light.png` | Giza, the brightest preset under the header |
| `focus-cover-chip-1440-rtl-light.png`, `focus-avatar-badge-1440-rtl-light.png` | Visible focus on both camera controls |
| `editor-gallery-1440-rtl-light.png`, `focus-gallery-radio-1440-rtl-light.png` | B1: tabs and grid in LTR order in Arabic |
| `editor-upload-error-1440-rtl-light.png` | B1: bidi-broken rules line and error alert |
| `editor-cover-crop-keyboard-1440-rtl-light.png` | B1: LTR zoom row and help text, after +,+,+,←,↑,R |
| `editor-avatar-crop-1440-rtl-light.png` | Same controls correctly RTL (no Tabs), for comparison |
| `editor-cover-crop-390-ltr-light.png`, `editor-cover-crop-768-ltr-dark.png` | B2: zoom slider collapsed, "100%" over Rotate |
| `editor-save-fail-1440-ltr-dark.png` | B3: focus ring on the whole dialog after a failed save |
| `editor-avatar-sheet-390-rtl-dark.png`, `editor-cover-gallery-sheet-390-rtl-dark.png` | Full-screen sheet; preview below the fold |
| `editor-remove-confirm-390-rtl-dark.png` | Inline remove confirmation |
| `editor-cover-uploaded-768-ltr-dark.png` | Uploaded cover: no way to re-crop the current photo |
| `state-no-cover-1440-rtl-light.png` | No cover = v3 flat navy + "Add a cover" |
| `state-loading-1440-ltr-dark.png` | Loading: "Add a cover" shown although the customer has a cover |
