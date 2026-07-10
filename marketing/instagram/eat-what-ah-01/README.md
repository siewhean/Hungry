# @hungry_singapore Carousel: Eat What Ah?

This folder contains the implemented Instagram brand/carousel package for `@hungry_singapore`.

## Files

- `brand-kit.md`: brand rules, palette, voice, logo, photography, and layout guidance.
- `carousel-spec.md`: slide strategy, copy, psychology, and prompt manifest.
- `caption-and-strategy.md`: caption, hashtags, posting strategy, Story idea, and comment prompt.
- `index.html`: editable carousel artwork source.
- `export-carousel.mjs`: Playwright export script.
- `slides/slide-01.png` through `slides/slide-07.png`: export-ready carousel PNGs at 1080 x 1350. Filenames are for export only; the artwork itself does not include slide numbers or navigation indicators.

## Export

Run from the repo root:

```bash
node marketing/instagram/eat-what-ah-01/export-carousel.mjs
```

The script screenshots each slide from `index.html` and writes PNG exports to `slides/`.
