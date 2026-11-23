---
version: v4-cover-glass
title: Cover glass
status: review # draft | review | approved | rejected | ported
base: v3-passport-stamp
created: 2026-11-22
tokens: override # tokens.css: v3's roles + --ah-* / --pm-* + NEW --cg-* cover glass tokens (section 5)
touches-components: [components/layout/header-top-bar.tsx, features/account/account-shell.tsx, features/account/account-hero.tsx, features/account/account-profile-card.tsx, NEW components/shared/user-avatar (Postmark + camera badge slot), NEW components/shared/image-editor (dialog, react-easy-crop cropper, client checks, canvas export), NEW features/account/cover (cover band, glass plate, cover button), NEW cover gallery data + public/covers/*.webp (8 presets, SOURCES.md), providers/auth-context.tsx (user.cover), backend users.cover field (presetId or uploaded image), backend PUT /users/me/cover (upload, re-encoded), backend PUT /users/me/cover/preset { presetId }, backend DELETE /users/me/cover, backend GET /users/me -> cover]
ported:
---

# Cover glass

Built on v3-passport-stamp (approved). v3's parts are copied here and extended; v3 itself is not edited.

## Idea
The customer can give their account a **cover photo**. It starts at the top of the page and runs behind the site
header and the account hero on every account page. The photo stays visible under a light navy veil, the header
becomes a **navy glass bar**, and the welcome title sits on a **frosted glass plate** (concept "glass-plate"). Every
layer is sized so the white text is AA over *any* photo, including a pure white one. With no cover set, the header
and hero are v3's flat navy, unchanged (D7). One **image editor** serves both the cover and the profile photo: gallery
or upload, crop, zoom, rotate, a live preview in context, remove, save.

## Key decisions
- **Glass layers, worst case over a white pixel** (tokens.css section 5, `--cg-*`; sRGB compositing, WCAG 2.x):

  | Layer | Recipe | Text on it | Contrast |
  |---|---|---|---|
  | Hero veil | navy-800 30 %, no blur | none (it only tints the photo) | n/a |
  | Title plate | navy-900 64 % over the veil, `blur(14px) saturate(1.2)`, 1 px white 14 % line, radius 16 | title white, subtitle navy-100 | 6.7:1 and 5.7:1 |
  | Header bar | navy-900 78 %, `blur(16px) saturate(1.2)` | nav links navy-200 (also in dark), white | 5.4:1 and 7.7:1 |
  | Cover button | the plate recipe | white icon and label | 6.7:1 |
  | Fallback | no `backdrop-filter`, or `prefers-reduced-transparency` | solid navy-800 85 % | white 7.9:1 |

  The hero stays navy in both themes, so the glass is the same in light and dark.
- **The cover runs behind the header too** (owner decision). The header keeps v3's structure, links and account
  button and only swaps its background for `.cg-bar`. The hairline between the header and the hero stays.
- **No cover is exactly v3.** The only addition is the hero's "Add a cover" button in the top-end corner (outline on
  navy). An expired cover link is caught by a preload and falls back to flat navy. While the page is loading the
  cover is not drawn.
- **Cover stored at 3:1** (1800×600 WebP). The cropper draws two guides: **Desktop** (full width, middle 62 % of the
  height, since 1440 × ~300 is ~4.8:1) and **Phone** (full height, middle 45 % of the width, since 390 × ~290 is
  ~1.35:1). On the page the image is `object-fit: cover`, centred.
- **Gallery**: 8 self-hosted Unsplash destinations at 1800×600 plus 480×160 thumbnails in `assets/covers/`, with the
  source, photographer and licence of each in `assets/covers/SOURCES.md`. Nothing is hot-linked. The eight are
  Makkah, Istanbul, Dubai, Giza, Riyadh, Antalya, Lusail (Qatar) and AlUla. A preset saves only its id
  (`PUT /users/me/cover/preset`).
- **Camera buttons**:
  - Hero: a 44 px glass chip in the top-end corner ("Change cover"). Below 640 px it shows the icon only, always
    with an accessible name.
  - Avatar: a 36 px navy disc in a 44 px target at the **bottom-start** of the 128 px Postmark. That is opposite the
    level badge (bottom-end) and the GOLD tail (end side), so the level marks stay whole. The card colour rings the
    disc.
- **One editor** (`parts/image-editor/`), built on Radix Dialog: focus trap, Escape, the page behind is hidden from
  assistive tech, and focus returns to the camera button that opened it.
  - Cover: tabs **Gallery | Upload**. Avatar: upload only.
  - Upload: drag and drop, **Choose a file**, paste (Ctrl+V anywhere in the dialog), and **Take a photo** on touch
    devices (`capture="environment"` for the cover, `"user"` for the avatar).
  - Client checks run before cropping, each with its own message (`role="alert"`): type JPEG/PNG/WebP, at most 5 MB,
    each side at least 200 px (measured after decoding, so it is the real pixel size). The rules are always shown.
  - Crop: a fixed-ratio frame (3:1 with the guides, or 1:1 under a round mask). Drag, the mouse wheel, a zoom slider
    from 100 to 300 %, **Rotate 90°**. Keyboard: arrows pan, + and − zoom, R rotates. A polite live region announces
    the zoom and rotation. The image can never leave an empty edge.
  - Live preview: the cover in a mini hero with the same glass; the avatar in its Postmark at 128, 64 and 32, and at
    32 on the navy bar, at the customer's current level.
  - Remove asks first, inline ("Remove the cover and go back to the navy background?").
  - Save shows "Saving…" with a spinner and blocks closing. A failed save shows an inline error and stays open
    (`&save=fail`).
  - Client export: canvas to WebP at 0.9, cover 1800×600, avatar 512×512. The backend re-encodes (docs/27).
  - Below 640 px the dialog is a full-screen sheet that slides up, with the actions pinned at the bottom and
    safe-area padding. Under `prefers-reduced-motion` it fades instead.
- **react-easy-crop is not installed** in the lab, the hub or web, and adding it would change the hub lockfile. So
  `parts/image-editor/cropper.tsx` is a small stand-in with the same contract: `{ zoom, rotation, x, y }` in, a canvas
  export out. The port should use react-easy-crop (`cropShape="round"` for the avatar) and keep the checks and
  export in `crop.ts`.
- **Data shape** (`parts/mock.ts`): `GET /users/me` → `cover: { url, thumbUrl, expiresAt, presetId } | null`, next to
  the existing `avatar`. Saves are mocked with a 1.1 s delay.
- **Motion**: the cover fades in on load (400 ms); the dialog rises 12 px, or slides up as a sheet (260 ms). All of
  it is off under reduced motion. Nothing loops.
- **Lab switches** (the fenced lab controls, or the URL): `&cover=none|gallery|upload`, `&pic=photo|initial|broken`,
  `&level=BLUE|SILVER|GOLD`, `&state=ready|loading|error`, `&name=arabic|latin`, `&save=fail`. Changing a switch
  drops whatever was saved in the editor during the session.

## Verification (2026-11-22)
- Full page at 390 / 768 / 1440 × ar-RTL / en-LTR × light / dark, GOLD, gallery cover:
  `shots/<width>-<rtl|ltr>-<theme>.png`. No horizontal overflow in any of the 12. Every new control is at least
  44 px; the only smaller link is v3's logo (110×40), which is unchanged.
- States: `shots/state-no-cover-1440-rtl-light.png` (flat navy as in v3, plus "Add a cover"),
  `shots/state-no-cover-no-photo-390-ltr-dark.png`, `shots/state-uploaded-cover-1440-ltr-light.png`,
  `shots/state-loading-1440-rtl-dark.png`.
- Editor, in order:
  - `editor-cover-gallery-1440-rtl-light.png`: AlUla picked, with the live mini hero.
  - `editor-cover-dropzone-1440-ltr-light.png` and `editor-cover-crop-1440-ltr-light.png`: upload, zoom 160 %, a
    drag, and both guides.
  - `editor-avatar-error-1440-rtl-light.png`: the real client checks. A GIF gave the type message, a 6 MB file the
    size message, and a 120×90 PNG the "120×90 px, each side at least 200 px" message.
  - `editor-avatar-crop-1440-rtl-light.png`: keyboard +, +, +, ←, R. The live region read "Rotation 90°".
  - `editor-saving-1440-rtl-light.png`, then `after-save-avatar-1440-rtl-light.png`: the new photo shows in the side
    card and in the header's 32 px stamp.
  - `after-save-alula-1440-rtl-light.png`: the cover changed and the live region read "Cover saved".
  - `editor-sheet-390-rtl-dark.png` (full-screen sheet, 390×844 at 0,0), then
    `editor-remove-confirm-390-rtl-dark.png`, then `after-remove-390-rtl-dark.png`: flat navy again, "Cover removed"
    announced.
- Focus: after a save, Escape or Cancel, focus returned to the camera button that opened the editor.
- After the shots, two small fixes were made and are not in the images: the Save button keeps full opacity while
  saving, and the Arabic crop help text was reworded.
- `pnpm lab:check` → "Lab: 57 versions compile."; `tsc --noEmit` with the lab tsconfig → 0 errors.
- Not checked in a browser: the `prefers-reduced-transparency` fallback (Playwright cannot emulate it; the CSS is the
  same rule as the no-`backdrop-filter` fallback), and a real phone camera.
- Lab note: screenshots written into this folder trigger a Vite full reload of the frame. Take them into a temp
  folder and copy them in afterwards.

## Open questions
1. The backend has no cover yet. Proposed: a `users.cover` field (preset id or stored image),
   `PUT /users/me/cover` (upload, re-encoded like the avatar), `PUT /users/me/cover/preset { presetId }`,
   `DELETE /users/me/cover`, and `cover` in `GET /users/me`. Should a preset be stored as an id (proposed) or copied
   as an image?
2. The gallery uses Lusail (Katara Towers) for Doha. Keep it, or find a Doha skyline?
3. On phones the visible strip of the cover is short (about 290 px including the header). Is that enough, or should
   the mobile hero grow by about 40 px when a cover is set?
4. The cover shows only on account pages, as asked. Should the site header elsewhere stay flat navy (assumed)?
