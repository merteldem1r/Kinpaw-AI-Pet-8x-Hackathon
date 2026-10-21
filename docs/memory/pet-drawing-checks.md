---
name: pet-drawing-checks
description: How to prove a change to the pet's drawing looks right without a device - render the website's PetSvg or the parts with the app's own matrices to PNG in Node, compare pixels
metadata:
  type: reference
---

Used in v3 pet looks (2026-10-09, [features/v3-pet-looks-plan.md](../application/features/v3-pet-looks-plan.md),
A1 and A2). The scripts lived in a session's scratchpad; rebuild them from this note.

- **Loading TS and TSX in Node:** native type stripping can't load `.tsx` or extensionless
  imports. A `node --import` loader with two hooks does: `resolve` tries `.ts`, `.tsx`,
  `/index.ts` for a relative import, and `load` runs `typescript`'s `transpileModule` (ESNext,
  `jsx: ReactJSX`). Stub `react-native-reanimated` (a `data:` module exporting a
  `useSharedValue`) to import `apps/mobile/lib/petPose.ts` or `petMotion.ts`.
- **Loader traps (2026-10-09):** a script in the scratchpad can't find the repo's packages:
  get `typescript`, `react`, `react-dom/server` and `sharp` through
  `createRequire(<repo>/package.json)` and resolve them in the `resolve` hook. Pass `fileName` to
  `transpileModule`, or a `.ts` file's `<T>` is read as JSX. The packages' entries are
  `packages/brand/index.ts` and `packages/contract/index.ts`; the web's `@/` is `apps/web/src/`.
- **Where a drawing lies in its square:** render at 800 px, take the bounds of the pixels that
  aren't clear. The eight looks span 42 to 185 of 200 across (the tail is on the right) and 15 to
  192 down; Welcome's touch areas come from this (A4c).
- **Rendering:** `react-dom/server`'s `renderToStaticMarkup(PetSvg)` (add `xmlns`, a size), then
  `sharp(Buffer.from(svg)).png()`. `sharp` and `pngjs` are installed (through Next.js). Poses:
  build the SVG from `petDrawing`'s parts yourself, each part in
  `<g transform="matrix(...)">` with `turnAbout` / `compose` from `lib/petPose.ts`, edges first.
- **The baseline:** the eight looks plus 120 `randomAppearance` pets (Plus included) from a
  seeded random (`s = s * 16807 % 2147483647`, seed 7), in all four moods: 512 images. Render
  before the change, after, and compare per pixel (count and largest channel difference), then
  group by pattern; a red-on-faded diff image shows where.
- **A look change (A5, 2026-10-12):** nothing to compare pixel by pixel, so read it by eye. Render
  the set before the change and after, then one sheet per scheme: the eight looks across, a
  "before" row and an "after" row per mood, on `palette(scheme).bg`, with the heads cropped large
  on a second sheet (a tuft or a whisker that looks fine at 250 px can be wrong at 1,000). Pass
  `shadow={false}`: the shadow's fill is a CSS variable, which `sharp` can't resolve.
- **What edge rounding looks like:** up to about 8 shades of 255 in a few dozen pixels at part
  edges. A whole streak or a ring that differs is a real change (brindle drawn twice at the neck
  was one). librsvg is not react-native-svg: geometry and colour carry over, the device still has
  the last word on how it moves.
