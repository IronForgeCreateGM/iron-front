# App Store screenshots (v7.9.15)

Upload these in App Store Connect → the app → version → Previews and Screenshots, one folder per device slot, files in name order
(01 first). Captions and Apple's size rules: `docs/app-store-listing.md` → Screenshots.

| folder | App Store Connect slot | size |
|---|---|---|
| `iphone63/` | iPhone 6.3" display (required iPhone slot) | 2622 × 1206 |
| `iphone69/` | iPhone 6.9" display | 2868 × 1320 |
| `ipad13/` | iPad 13" display (required for iPad) | 2752 × 2064 |
| `mac/` | Mac | 2880 × 1800 |

Regenerate: `node test/appstore-shots.js /workspace/appstore-shots --pack` (raw PNGs to the first folder, RGB JPEGs here).
Check: `node test/appstore-shots-meta-test.js`. This folder is not part of the app bundle (`scripts/build-www.js` skips it).
