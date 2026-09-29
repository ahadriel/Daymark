# Release builds

The **Build Daymark Apps** workflow runs when a `v*` tag is pushed or when started manually from GitHub Actions. It uploads:

- `daymark-windows`: the Windows NSIS `.exe` installer.
- `daymark-android-debug`: a debug `.apk` that can be installed for testing.

The APK is not signed for Google Play distribution. A future release setup can add a private Android keystore and Play publishing credentials to GitHub Actions secrets. Keep the keystore and passwords out of the repository.
