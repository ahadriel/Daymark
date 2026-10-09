# Release builds

The **Build EONIS Apps** workflow runs when a `v*` tag is pushed or when started manually from GitHub Actions. It uploads:

- `eonis-windows`: the Windows NSIS `.exe` installer.
- `eonis-android-debug`: a debug `.apk` that can be installed for testing.

The APK is not signed for Google Play distribution. A future release setup can add a private Android keystore and Play publishing credentials to GitHub Actions secrets. Keep the keystore and passwords out of the repository.
