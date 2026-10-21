# EONIS Browser (Android)

A native Kotlin Android browser prototype using Android WebView, with a custom midnight interface.

## First-build features
- Native home screen and quick links
- Address bar with DuckDuckGo search
- WebView navigation, back/forward, refresh via page navigation
- Multiple tabs and tab switching
- Bookmarks and session history
- DownloadManager integration
- Basic private-tab mode
- HTTPS-first URL handling and no file/content access in WebView

## Build
Open this directory as an Android Studio project, or run:

```bash
gradle assembleDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`.

GitHub Actions builds the APK and uploads it as an artifact named `eonis-browser-apk`.

## Prototype notes
This is an early browser build, not yet a replacement for Chrome. Private mode is a first iteration and currently clears WebView cookies when started; avoid treating it as a hardened privacy boundary. Next improvements should isolate private cookies properly, persist bookmarks/history, add a real refresh control and file chooser, and test download behavior on-device.
