# Icon sources

🎨 REPLACE: placeholder art, drawn from the screen spec's "App icon and logo mark"
(`docs/application/UI/kinpaw-screen-spec-v1.md`) until the final icon exists.

Each SVG here is the source of the PNG of the same name one folder up:

| Source            | PNG                        | Used by                                                 |
| ----------------- | -------------------------- | ------------------------------------------------------- |
| `icon.svg`        | `icon.png` (1024², opaque) | `app.json` `icon` and `ios.icon.light`                  |
| `icon-dark.svg`   | `icon-dark.png`            | `ios.icon.dark` (iOS 18+)                               |
| `icon-tinted.svg` | `icon-tinted.png`          | `ios.icon.tinted` (iOS 18+)                             |
| `logo-mark.svg`   | `logo-mark.png` (256²)     | `LogoMark` (`components/ui/Marks.tsx`); the web favicon |
| `splash.svg`      | `splash.png` (transparent) | the splash screen, on its midnight background           |

To re-render one after editing it (from the repo root; `sharp` is already installed):

```bash
node -e "require('sharp')('apps/mobile/assets/icon/source/icon.svg', { density: 300 }).resize(1024, 1024).flatten({ background: '#000000' }).png().toFile('apps/mobile/assets/icon/icon.png')"
```

The three app icons must stay square and opaque (`flatten`): iOS masks the corners itself.
The logo mark and the splash keep their transparency (drop `flatten`); the logo mark is
rendered at 256² and also copied to `apps/web/src/app/icon.png`.
