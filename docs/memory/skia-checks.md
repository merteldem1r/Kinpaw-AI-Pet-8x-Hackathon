---
name: skia-checks
description: How to check Skia drawing and shaders without a device - CanvasKit in Jest and off screen in Node, what it can't draw, and opening a dev screen on the Simulator by link
metadata:
  type: reference
---

Used in v3 pet looks, B0 (2026-10-12, [features/v3-pet-looks-plan.md](../application/features/v3-pet-looks-plan.md)).
The SVG pet's checks are in [[pet-drawing-checks]]; this is the same idea for Skia.

- **A build without Skia throws on import.** Only files loaded behind `hasSkia()`
  (`apps/mobile/lib/skia.ts`) may import `@shopify/react-native-skia`, with a `require` at the
  boundary. The iPhone's build has no Skia until Mert rebuilds it ([[xcode-free-account-signing]]).
- **In Jest:** `jest.config.js` loads Skia's mock; a test that imports Skia starts with
  `@jest-environment @shopify/react-native-skia/jestEnv.js` in its first comment, which loads
  CanvasKit (Skia in WebAssembly, about 20 s the first time). `Skia.RuntimeEffect.Make(sksl)` is
  null for a shader with a mistake, so a test can prove every shader compiles. (`cast` is a
  reserved word in SkSL; and a backtick in a comment inside the shader's template string ends it.)
- **Drawing in a test** (`petCanvas.test.tsx`): Skia's `headless` build draws a scene to an
  image whose pixels a test can read. Three traps under Jest: (1) only Skia's `lib/module` may be
  compiled by Jest; compiled again, the worklets plugin breaks `lib/commonjs` ("replay is not a
  function"); (2) Jest resolves `sksg/Container.native`, which wants the native view: mock
  `sksg/Container` to make a `StaticContainer`; (3) CanvasKit lives outside the test's realm and
  checks `instanceof Array`, so a gradient's colours must be handed over as its own arrays.
  Loading CanvasKit inside the test's realm fails ("Unknown encoding: utf-16le").
- **Off screen in Node, to look at it:** `canvaskit-wasm/bin/full/canvaskit` into
  `globalThis.CanvasKit`, then `@shopify/react-native-skia/lib/commonjs/headless`
  (`makeOffscreenSurface`, `drawOffscreen(surface, element)`, `getSkiaExports().Skia`,
  `image.encodeToBytes()` is a PNG). Keep the scene free of hooks and hand it plain values where
  the app hands it shared values; alias the package to the headless build in the loader of
  [[pet-drawing-checks]] (a small ESM file that re-exports the components the scene uses).
- **What CanvasKit can't draw:** a `RuntimeShader` as a layer's image filter ("Not implemented
  on React Native Web"). A shader as a shape's own paint works. So a layer shader compiles in a
  test but can only be seen on the Simulator or a phone.
- **A layer's shader is not density aware:** drawn plainly, the layer is one pixel a point and
  comes out soft. Scale out to pixels, put the layer there, scale back in inside it, and give
  the shader its coordinates in pixels.
- **On the Simulator:** it takes no taps, so give a dev screen a route and open it by link
  (`xcrun simctl openurl <device> "cozypet://dev-pet?renderer=puppet&look=4&mood=sad"`, the living
  pet without an account). Send the link only once
  the app has finished loading (about 40 s after a cold start): sent while the bundle loads, the
  dev client shows "There was a problem loading the project". A red "Should not already be
  working" from react-reconciler after several quick saves is fast refresh, not the code:
  restart the app. Frame times on the Simulator say nothing about the iPhone.
