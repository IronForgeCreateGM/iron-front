# ios-plugin/ — copy-paste pieces for the Xcode project

There is no `ios/` folder in the repo yet. It gets created on a Mac with `npm run cap:add:ios` once the MBEP Productions LLC
Apple Developer account exists. After that, copy these files in (paths are inside the generated `ios/App/App/` folder):

| File here | Goes to | What it is |
|---|---|---|
| `AppIcon.appiconset/` | replace `Assets.xcassets/AppIcon.appiconset/` (whole folder) | App icon: one 1024x1024 universal iOS icon (Xcode 15+ makes every iPhone/iPad size from it) plus the Mac sizes 16–1024 for Mac Catalyst. RGB, no transparency. Made from `icons/icon-1024.png`. |
| `LaunchScreen.storyboard` | replace `Base.lproj/LaunchScreen.storyboard` | Launch screen: plain `#05080c`, same as the title screen and the web view background, so there's no white flash. No text/logo (Apple's rule). Capacitor's `Splash` image set is then unused and can be deleted. |
| `PrivacyInfo.xcprivacy` | add to target **App** (tick "Copy items if needed") | Privacy manifest: no tracking, no data collected. |
| `IronViewController.swift`, `IronGameCenterPlugin.swift` | add to target **App** | Native plugins (see APP-STORE.md and GAME-CENTER.md). |

Then in Xcode → target App → General: App Icons source = `AppIcon`; Launch Screen File = `LaunchScreen`.
`node test/appstore-meta-test.js` and `npm run check:www` check these files are present and valid.
