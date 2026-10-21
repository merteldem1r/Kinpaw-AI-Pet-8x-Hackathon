---
name: xcode-free-account-signing
description: Trap - device builds use a free Apple account; the signing fix lives only in the generated ios/ folder and a native rebuild can undo it
metadata:
  type: project
---

Mert builds to an iPhone with a **free Apple account**, which cannot use the Sign in with
Apple capability. The fix is made **in Xcode only**, in the generated, gitignored
`apps/mobile/ios/` folder:

1. Open `apps/mobile/ios/*.xcworkspace`, select the app target, Signing & Capabilities.
2. Set **Team** to the personal team.
3. Remove the **Sign in with Apple** capability.

**Never** remove `usesAppleSignIn` or `expo-apple-authentication` from `apps/mobile/app.json`
to fix signing. `app.json` itself is edited normally (name, icon, bundle ID in M2).

Anything that regenerates `ios/` undoes the fix: `npx expo prebuild --clean`, deleting
`ios/`, or a native change (app.json name, bundle ID, icon, plugins, a new native module)
followed by a rebuild. A changed bundle ID also needs a new provisioning profile.

**Why:** a free account's provisioning profile doesn't include the Sign in with Apple
entitlement, so the build fails to sign for a device.

**How to apply:** after any native rebuild, remind Mert that the signing fix may need
redoing. The Simulator doesn't need it. See [[ios-only]].
