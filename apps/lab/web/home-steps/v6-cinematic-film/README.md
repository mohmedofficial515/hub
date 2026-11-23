---
version: v6-cinematic-film
title: Cinematic film (GIF)
status: draft
base: v1-baseline
created: 2026-11-22
tokens: override
touches-components: [features/home/features-section.tsx, components/shared/decorative-plane.tsx]
ported:
---

# Cinematic film (GIF)

## Idea
A silent 16 s film of the real booking flow, looping as a GIF across the section (16:9), with the three steps written
under it. Owner choices (2026-11-22): 16:9 across the section, about 16 s, one film per locale (ar, en).

Storyboard (`F:/tools/hams/output/video/goteav-booking-film-20261122/index.html`):
1. 0-3.8 s, search: navy dot map, camera pulls back; CAI and IST pins pulse, the gold route draws with a plane on it;
   the search card swings up in 3D and fills field by field; the cursor presses Search; a teal iris opens from it.
2. 3.8-7.4 s, results: top bar and filters drop in; three flights cascade out of blur, prices count up; "Cheapest"
   stamps on the 198 fare and that card climbs to the top; it is picked, the others blur away, it grows into the next screen.
3. 7.4-11.8 s, travellers and pay: the passport name types itself, the wallet is chosen, Pay turns into a spinner
   and a drawn check ("Paid"); a navy sweep with gold edges crosses the frame.
4. 11.8-14.7 s, ticket: the boarding pass swings in, barcode bars rise, a "Confirmed" stamp lands on the stub, the
   "Your ticket is in your inbox" notice rises under it.
5. 14.7-16 s, outro: the plane flies off along a gold arc, the goteav wordmark and the approved hero line appear,
   then everything returns to the opening frame (frame 320 = frame 0, checked) so the loop has no seam.
A step chip (1/2/3 with three bars) stays at the top inline start through the film.

## Production
- hams project `goteav-booking-film-20261122` (git-ignored `output/`): HyperFrames 0.8.186 + GSAP 3.14.2 (vendored),
  Cairo (Google Fonts OFL, vendored). One composition; language from the `lang` variable:
  `npx hyperframes@0.8.186 render --fps 30 --quality delivery --variables '{"lang":"en"}' -o renders/booking-en.mp4`.
- `production/to-gif.sh <lang> 1280 20`: two-pass palette GIF (192 colours, `stats_mode=diff`, sierra dithering,
  `diff_mode=rectangle`), a still at 13.6 s, plus MP4 (H.264) and WebM (VP9) web copies.
- Files in `media/`: GIF 8.1 MB (ar) / 8.0 MB (en), 1280x720, 20 fps, 320 frames, infinite loop; MP4 0.78 MB;
  WebM 0.66 MB; still 145 KB.

## Key decisions
- Flat site colours only (navy, teal, gold, white); no gradients or glows, which also keeps the GIF palette clean.
- Sample data (CAI → IST, USD 198, AHMED ALI, GTV7Q2); the caption under the film says it is an example.
- A GIF cannot pause, so a 44 px Pause button swaps it for the still (WCAG 2.2.2); with reduced motion the still
  shows first with Play. The `alt` text tells the whole story for screen readers.

## Open questions
- Size: the GIF is 8 MB per locale; the same film as MP4/WebM is about 10 times smaller and looks sharper. Ship the GIF
  as asked, or a muted, looping, inline `<video>` (WebM + MP4, still as poster) with the GIF only as a fallback?
- Turkish film: add `tr` strings to the composition at port time.
