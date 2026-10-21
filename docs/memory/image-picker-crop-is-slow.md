---
name: image-picker-crop-is-slow
description: expo-image-picker's allowsEditing switches iOS to the old UIImagePickerController, which takes 2–3 s to open; without it, PHPicker opens fast
metadata:
  type: reference
---

On iOS, `expo-image-picker`'s `launchImageLibraryAsync` uses the modern **PHPicker** only when
`allowsEditing` is false. With `allowsEditing: true` (the square crop) it falls back to the old
**UIImagePickerController** (`ImagePickerModule.swift`, `launchImagePicker`), which took 2–3
seconds to appear on Mert's devices (2026-10-02). Edit profile therefore picks without a crop
and fills the avatar circle from the photo's centre. A crop step comes back only as our own
screen, with `expo-image-manipulator` at the next native rebuild (ideas.md, "Profile photo").
Neither picker needs the photo library permission: both share only the photo chosen.

See [[local-checks-and-traps]].
