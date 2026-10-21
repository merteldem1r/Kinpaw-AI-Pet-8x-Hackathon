---
name: local-device-networking
description: How the Simulator and the iPhone reach the local stack (no IP edits since 2026-10-02), the QR-code routine, and where the sign-in code arrives
metadata:
  type: reference
---

- **`.env.local` keeps `127.0.0.1`** for `EXPO_PUBLIC_SUPABASE_URL` (port 55321) and
  `EXPO_PUBLIC_SITE_URL` (port 3000), on the Simulator and the iPhone alike. Since 2026-10-02 a
  development build moves a loopback URL onto the host Metro served the bundle from
  (`apps/mobile/lib/devHost.ts`, applied in `lib/env.ts` under `__DEV__`), so a real iPhone
  reaches the Mac at whatever Wi-Fi address it has that day. Mert no longer edits the IP. An
  agent never reads `.env.local`.
- **The iPhone routine:** install the development build once (`npm run mobile:ios:device`,
  again only after a native change); then `npm run web:dev`, `npm run mobile:start`, and scan
  Metro's QR code with the iPhone's Camera. Same Wi-Fi as the Mac. Next.js (`*:3000`) and the
  Supabase containers (`*:55321`) listen on every interface, checked 2026-10-02.
- **"Failed to connect to http://<old ip>:8081"** on the phone is the development build
  remembering an old Metro address: scan the QR code, or enter the current one by hand.
- **No cable:** pair once in Xcode (Window → Devices and Simulators → Connect via network).
  With a free Apple account an installed build expires after 7 days; reinstall, and see
  [[xcode-free-account-signing]] if `ios/` was regenerated.
- **Sign-in codes** land in the local mail catcher at <http://127.0.0.1:55324>, not a real
  inbox. Supabase Studio is at <http://127.0.0.1:55323>. Ports are in `supabase/config.toml`.
- The app runs in a development build (`npx expo run:ios` from `apps/mobile`), not Expo Go.

See [[hackathon-localhost-only]], [[local-checks-and-traps]].
