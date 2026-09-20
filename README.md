# hotel-demos

A reusable, config-driven demo generator for boutique hotel sales demos. Each hotel is one JSON config; the shared template renders it into a static, bilingual (EN/AR) one-page site published via GitHub Pages from `/docs`.

Live: https://hafez121.github.io/hotel-demos/

## How it works

```
hotels/<slug>/config.json   ← all copy, facts, contact info, palette, media references
hotels/<slug>/media/        ← processed media (checked in): photos (AVIF/WebP), hero video, poster, og.jpg
template/render.mjs         ← pure function (config, lang) -> HTML string
template/css/, template/js/, template/assets/  ← shared stylesheet, client script, SVG assets
build.mjs                   ← renders every hotels/*/config.json into docs/<slug>/ (EN) and docs/<slug>/ar/ (AR)
scripts/media.mjs           ← downloads + processes a hotel's photos and hero video from its config
scripts/og-image.mjs        ← renders the 1200x630 Open Graph image from the poster frame + wordmark
scripts/verify.mjs          ← Playwright checks (video, parallax, links, layout) + screenshots
```

## Adding a new hotel

1. Copy `hotels/le-blanc-bleu/config.json` to `hotels/<new-slug>/config.json` and edit every field.
   Only use facts you can verify from the owner's own materials — never invent prices, amenities, or claims.
2. In the config's `media` block, list the real photo filenames to pull from the owner's site
   (`media.photoSource` + `media.photoFiles`) and the chosen Pexels hero video (`media.heroVideo`).
   Pick the video by hand first (calm water, no people/boats/logos, ≥1920px wide) and record its id/url/author —
   this keeps media choices reviewable instead of automated and unaudited.
3. Run the pipeline:
   ```
   node scripts/media.mjs <new-slug>      # downloads + processes photos and hero video
   node scripts/og-image.mjs <new-slug>   # renders the OG share image
   node build.mjs <new-slug>              # renders docs/<new-slug>/ (en) and docs/<new-slug>/ar/ (ar)
   ```
   Or `npm run build` with no slug to rebuild every hotel.
4. Serve `docs/` locally and check it: `npm run serve`, then `node scripts/verify.mjs`.
5. Commit and push. GitHub Pages serves `/docs` on `main` directly — no separate deploy step.

**No template edits are needed to add a hotel.** If a section has no factual source in the new hotel's
materials, delete that section's key from its `sections` object in the config and remove the
corresponding block in `template/render.mjs` only if you want it hidden sitewide — otherwise leave the
markup as-is and simply don't populate content that doesn't exist for that property (the pattern used
here assumes every hotel has all sections; if a future hotel genuinely lacks one, guard that block in
`render.mjs` with `S.sectionName &&`).

## Flipping a demo to launch mode

Each config has `"demo": true`. When the owner is ready to go live:

1. Set `"demo": false` in `hotels/<slug>/config.json`.
2. Remove or leave the `demoBanner` block — it is only rendered while `demo` is `true`... actually the banner
   markup is currently unconditional; if shipping for real, delete the `.demo-banner` block in
   `template/render.mjs` (or gate it with `${config.demo ? ... : ""}`) before the final build.
3. Re-run `npm run build`. This removes the `<meta name="robots" content="noindex, nofollow">` tag so the
   page becomes indexable.
4. Replace the Pexels stock hero video with the owner's own footage once available, and re-run
   `node scripts/media.mjs <slug>` after updating `media.heroVideo` (or swapping the cached source file).

## Verification

```
npm run build
npm run serve            # serves docs/ on :8080
node scripts/verify.mjs  # Playwright checks + screenshots into verify/
npx lighthouse http://localhost:8080/<slug>/ --preset=mobile --output=html --output-path=verify/lighthouse-<slug>.html
```

## Notes

- No client-side framework, no CSS framework — vanilla HTML/CSS/JS output.
- Fonts are self-hosted (`@fontsource`), subset to the weights actually used, `font-display: swap`.
- Parallax is transform-only (`translate3d`) via a single `requestAnimationFrame` loop, gated by
  `IntersectionObserver` and disabled under `prefers-reduced-motion` or `navigator.connection.saveData`.
- See `DECISIONS.md` for every judgment call made per hotel (media choices, omitted sections, anything
  that needs the owner's confirmation).
