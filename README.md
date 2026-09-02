# Munsell Eye

A minimal color-identification trainer for painters, built around discrete Munsell hue, value, and chroma notation.

[Open the live app](https://munsell-eye-color-training.pet-ty.chatgpt.site/)

## Practice modes

- **Value** — identify N1–N9 through colored targets, with an optional monochrome view.
- **Hue** — identify one of the 40 standard hue steps using each hue’s highest displayable chroma.
- **Chroma** — identify practical painter chromas C2–C12.
- **Family** — choose a fixed hue leaf, such as 5RP, then identify value and chroma across its valid chips.
- **Full H/V/C** — identify all three coordinates.
- **Swatch, context, or image** — work from an isolated chip, a controlled 3×3 simultaneous-contrast grid, or a natural photograph with a locally sampled Munsell lens.

The Reference view contains the 40-step hue wheel and constant-hue chip pages. Practice is intentionally limited to C2–C12, while the reference preserves valid higher-chroma chips where the source data and display gamut support them.

Progress and adaptive weighting are stored only in the current browser with IndexedDB. There are no accounts.

## Color data

The discrete chip set is generated from the RIT Munsell Renotation `real.dat` dataset (Illuminant C), adapted to D65 sRGB. Screen colors are useful training approximations, not replacements for calibrated physical Munsell chips; display gamut and calibration affect every rendered swatch.

The image bank combines local public-domain/CC0 works with openly licensed Openverse results and public Unsplash photographs. Individual credits and source links are shown in the app. Photographs remain untouched while a locally coherent sample is matched to the nearest displayable Munsell chip.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Copy `.env.example` to `.dev.vars` and add an Unsplash Access Key to enable Unsplash locally. Openverse and the bundled image set remain available without it. Keep `.dev.vars` private; it is excluded from Git.

Useful checks:

```bash
npm run lint
npm run build
```

## Project structure

- `app/` — interface, practice logic, progress storage, and generated color data
- `data/real.dat` — source Munsell Renotation dataset
- `scripts/build-munsell-data.mjs` — color-data generator
- `public/practice/` — credited practice imagery
