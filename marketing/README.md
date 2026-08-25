# Acedit — social ad assets

Everything here is generated from HTML so the type stays brand-exact rather than
being redrawn by hand. Same pipeline as the footyballr assets: headless Chrome
renders each scene at 2x, ffmpeg does the Ken Burns push and the crossfades.

## What's in here

| File | Size | Where it goes |
|---|---|---|
| `acedit-reel-recall.mp4` | 1080×1920, 16.7s, silent | Reel / TikTok / Short — **lead ad** |
| `acedit-reel-tutor-tax.mp4` | 1080×1920, 16.5s, silent | Reel / TikTok / Short — the price angle |
| `carousel/acedit-carousel-1…6.jpg` | 1080×1350 ×6 | Instagram carousel |
| `acedit-post-tutor-tax.jpg` | 1080×1350 | Feed post — price punch |
| `acedit-post-marked.jpg` | 1080×1350 | Feed post — product proof |
| `acedit-post-honest.jpg` | 1080×1350 | Feed post — brand/identity |
| `acedit-reel-endcard.jpg` | 1080×1920 | Story, link-in-bio card |

Captions, hooks and the on-screen scripts are in `captions.md`.

## The two reels

Both follow the same spine — **hook → problem → reframe → product → price → CTA** —
but pull on different pillars from the marketing strategy, so they can run at the
same time without cannibalising each other.

**`recall`** is Pillar 4 (Fake Studying). It opens on a specific, universal
moment (11:47pm, read the page four times) rather than on the product, reframes
re-reading vs recalling, then shows the answer-and-get-marked loop. This is the
one to lead with — the hook needs no prior interest in Acedit.

**`tutor-tax`** is Pillar 3 (The Tutor Tax). Opens on a price, lands on the
equity line — "acing VCE shouldn't come down to whose parents can afford a
tutor" — which is the most shareable sentence in the set. Expect lower
click-through than `recall` but higher saves and comments.

## Posting notes

**The reels have no audio on purpose.** Add a trending track inside
Instagram/TikTok when you post — clips using in-app audio get pushed harder than
ones with baked-in sound. On TikTok, reading the on-screen script aloud over the
top (see `captions.md`) will outperform the silent version; the frames are
timed to be readable either way.

**Safe areas.** Everything readable sits between 260px and 1580px of the 1920
frame, because Instagram covers roughly the top 220px (profile row) and the
bottom 330px (caption + buttons). The end-card URL is deliberately high for the
same reason.

**Carousel.** Slide 1 is the whole job — it's the only one most people see.
Slides 4 and 5 are the product proof; if you ever cut the carousel down, keep
1, 3 and 6.

## Claims — worth knowing before you boost these

These get read by parents and, if you run paid, by ad reviewers.

- **VCAA wording.** Every asset says "VCAA-aligned", "VCAA-style" or
  "examiner-style". None claims endorsement or affiliation, and that line
  shouldn't be crossed — VCAA is a government body and its name is protected.
- **"$120 an hour."** This is the top of the Melbourne range, not the median.
  The `tutor-tax` reel says so on screen ("that's a good one, the cheap ones are
  $60") and the `recall` reel shows the honest `$60–120` range. Keep those
  qualifiers if you re-cut.
- **The 57%-vs-29% active-recall stat** from the strategy doc is deliberately
  *not* on screen anywhere. It's a real finding in spirit, but I couldn't pin it
  to a specific paper with those exact numbers, and a wrong citation in an ad
  aimed at students is not worth the reach. The carousel makes the same argument
  without a number. If you want the stat on a slide, find the source first and
  I'll add it with the citation.
- **Scores shown (7/8, 5/6, 8/10)** are illustrative examples of the marker's
  output format, not screenshots of a real student's result.

## Regenerating

```bash
python3 render.py reel-recall.html frames/recall 1080 1920
```

Then stitch:

```bash
python3 build_reel.py frames/recall acedit-reel-recall.mp4 2.4 2.2 2.7 2.9 3.1 2.5 3.0
```

The numbers are the per-scene durations in seconds. `build_reel.py` handles the
alternating zoom and the 0.35s crossfades; total runtime comes out ~2.1s shorter
than the sum because the fades overlap.

Source files: `brand.css` (tokens, mirrored from `src/index.css`), `frame.js`
(shows one scene per URL hash), and one HTML per asset. Fonts are vendored in
`fonts/` so a render never depends on the network.

`frames/` is 47MB of 2x PNG intermediates — safe to delete, regenerates in a
couple of minutes.

Chrome's new headless mode hangs after the first screenshot on this machine, so
`render.py` uses the old one and kills the process once the PNG lands. If
rendering ever stalls, that's the thing to look at.
