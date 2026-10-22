# Native remediation candidate QA — 20 October 2026

Status: bounded native validation; Android build/runtime and several release acceptance checks remain open. No production deployment, signing, upload or paid service. Source implementation and unit checks do not establish native acceptance.

## Environment and provenance

- Checkout base: `50b2223e3ee058618bc23db48a97fb9fafac41ee`, dirty remediation tree. Source integration is still active; final candidate must receive a final source fingerprint before acceptance.
- Xcode 27.0 build 27A5252f, `/Applications/Xcode-beta.app/Contents/Developer`; CocoaPods 1.17.0; Node 22.22.1 available via existing nvm.
- Target simulator: `C643EFF0-479E-4643-A62B-B6ECB277D823`, Hungry iPhone 17 Pro / iOS 26.5. A second iOS 27 simulator is already booted. No Android devices/emulators were attached (`adb devices -l`).
- Gradle 9.0.0; default Java 25 replaced per-command with existing OpenJDK 17 (`/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`).
- Free disk: initially 17 GiB, then 10 GiB during concurrent SDK/native build preparation. No existing app/user files removed.

## Dependency preparation

`PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH" pod install --project-directory=ios` succeeded: 130 dependencies, 143 pods, including ExpoSharing 55.0.24. CocoaPods updated `ios/Podfile.lock` and `ios/Hungry/PrivacyInfo.xcprivacy`; existing native changes preserved. Log: `native/pod-install.log`.

Android initially failed at `android/build.gradle:24` with `SDK location not found`. Log: `native/android-build.log`. This was an environment prerequisite, not an APK compilation verdict. Root authorized local prerequisite installation.

Official [Android command-line tools](https://developer.android.com/studio#command-line-tools-only) ARM64 package `commandlinetools-mac_arm64-15859902_latest.zip` downloaded from Google's `dl.google.com` and verified against the published SHA-256: `835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e`. Installed under standard user `~/Library/Android/sdk/cmdline-tools/latest`. SDK Manager 22.0 works with JDK 17; its deprecation notice recommends the newer Android CLI. SDK licenses accepted for build prerequisites. Installing exact project requirements: API 36, build tools 36.0.0, NDK 27.1.12297006, CMake 3.22.1, platform tools. Logs: `native/android-sdk-licenses.log`, `native/android-sdk-install.log`. No emulator/system image installation while disk is constrained.

## iOS build

Initial universal Release attempt was deliberately interrupted to avoid redundant x86_64 compilation and disk cost (`native/ios-build-initial.log`). This interruption is not a compiler failure.

Current command:

```sh
EXPO_PUBLIC_APP_ENV=development EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE=mock xcodebuild -workspace ios/Hungry.xcworkspace -scheme Hungry -configuration Release -sdk iphonesimulator -destination id=C643EFF0-479E-4643-A62B-B6ECB277D823 -derivedDataPath /tmp/hungry-remediation-derived ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO build
```

Log: `native/ios-build.log`. This is an unsigned simulator candidate using explicit mock data, not production authentication/backend or staging proof. Actual candidate bundle/binary hashes, installation and journeys will be added after build.

## Runtime acceptance still open

Fresh-candidate primary journeys, relevant gates, offline recovery/banner overlap, keyboard/large text, VoiceOver/TalkBack and runtime logs remain open until executed and recorded. Existing Maestro flows assume a Developer Launcher and Metro; they must not be counted as passing on a Release candidate without exercising real interactions. Real host-network shutdown would affect unrelated user work, so simulated offline controls must be labeled separately from actual OS/network outage evidence.

## Auth/onboarding focused source evidence

`native/auth-onboarding-tests.log`: 22 behavior tests pass, covering actual RHF validator adapters, synchronous submission exclusion/retry, exact eight-digit OTP, wall-clock cooldown, consumed recovery-code retry/generation retirement, deletion receipt semantics, shared draft/retake preservation, guest preference snapshot through SDK event order, hard dietary zero matches, queued save retry/idempotence/generation retirement, and delayed GPS versus manual/reset. Scoped ESLint passed. Node emits only the existing module.register deprecation warning. These checks do not replace native/backend acceptance.

## Initial fresh-native preflight (not final source acceptance)

The ARM64 Release build succeeded without compiler errors. Original app: `/tmp/hungry-remediation-derived/Build/Products/Release-iphonesimulator/Hungry.app`. Isolated copy: `/tmp/hungry-remediation-nativeQA/HungryQA.app`; artifact-only bundle identifier `app.hungry.mobile.remediationqa`, display name `Hungry QA`, OTA disabled. Existing simulator Hungry application/data remains intact. Installed/launched successfully on iOS26.5. `native/ios-preflight.png` records Welcome. `native/ios-runtime-preflight.log` records standard background-fetch declaration, OS duplicate-class and dropped lifecycle-event warnings; no observed JS fatal or app crash.

Xcode27 now exposes simulators through `/Applications/Xcode-beta.app/Contents/Applications/DeviceHub.app`; there is no `Simulator.app`. Maestro2.6.1's XCTest driver timed out (`native/maestro-preflight.log`); this is a test-driver failure, not an app failure. Native UI is operable through Device Hub's accessibility tree and CUA. Initial interactions verified zero-cuisine Next, distinctive sweet selection restored on Back, explicit Use my location, and manual search/selection.

Preflight found a real keyboard defect: manual picker search/selected Orchard left Continue completely behind the iOS keyboard (`native/ios-manual-keyboard-before.png`). A bounded `KeyboardAvoidingView` plus Done-to-dismiss fix was applied to `ManualLocationPickerScreen.tsx` and scoped lint passed. The final current-source bundle must reproduce this path and capture the repaired state before closure.

The initial universal and final ARM64 iOS build generated compiler/link caches. After successful native linking, only this task's generated intermediate caches were removed to make room for Android prerequisites; both original .app and isolated QA copy/logs remain. Android's AGP default additionally requests NDK27.0.12077973 for an Expo module, alongside the project's27.1; Gradle installs that supported prerequisite without source/config overrides. Final APK build remains in progress.

## Final runtime and environment findings

The supported RouteQA variant uses `--dev false --minify true`, development app environment and explicit mock provider. Its isolated artifact is `/tmp/hungry-remediation-nativeQA/HungryRouteQA.app`, bundle ID `app.hungry.mobile.remediationrouteqa`, display name Hungry Routes QA, with artifact-only OTA disabled. Production flags/authentication are not established by this variant. A separate attempted dev=true JavaScript bundle embedded in the Release native binary white-screened with Expo55 `Cannot create devtools websocket connections in embedded environments`; logs `native/ios-runtime-final-dev.log` and `native/ios-unified-final-dev.log`. This packaging combination is unsupported, and was not repaired with a runtime shim. Its failed app copy was removed during bounded disk recovery.

Actual CUA interactions on the working RouteQA variant passed Welcome → optional Cuisine Next → Quiz Skip → Location → manual Orchard search/selection → Continue with keyboard still open → Home. `native/ios-manual-keyboard-after.png` shows the repaired button above the keyboard; the tap completed navigation. Home → Discover → Laksa search → See all results → Signature Laksa detail → guest Save → Login also completed. Login Sign in remains reachable above the keyboard (`native/ios-login-keyboard.png`). No JS fatal/crash was observed in `native/ios-runtime-final-route.log`; OS background-fetch/duplicate-class/lifecycle-event warnings remain recorded.

That native detail journey found an actual mock fixture ownership defect: Laksa's displayed venue name disagreed with its canonical venue ID, causing unrelated menu items. Independent discovery remediation corrected Laksa and the same-cause Kaya Toast ownership, with 47/47 focused checks (`native-attribution-followup.md`, `native-attribution-regression.log`). Final-source rebuilt-candidate recheck is recorded below.

Android prerequisite installation succeeded, including AGP's additional NDK27.0.12077973. The final arm64 `:app:assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a` attempt failed after 9m22s with `mergeReleaseJniLibFolders FAILED` and CMake `IO failure on output stream: No space left on device` (`native/android-build-release.log`, lines389–495). No APK was produced. Actual free disk fell to168MiB, also interrupting a browser test writer. Build processes had exited; only this task's generated `android/app/build/intermediates`, `android/app/.cxx`, temporary SDK download/extract and failed QA app copy were removed. Original Release app, working RouteQA app, logs, installed SDK and all user/source files were preserved. Free disk recovered to7.7GiB; further native/Android rebuilds were bounded to avoid another host-wide exhaustion. No Android emulator/system image was installed; no Android device was attached. APK and TalkBack/runtime proof remain open.

Offline-banner overlap/recovery, VoiceOver, large text, permissions, real Supabase authentication/deletion/media, relevant gated flows, and full iOS/Android acceptance remain open. The normal RouteQA binary cannot expose the dev launcher, while a proper Debug native+Metro build would require additional native build space. Browser/simulation evidence must be reported separately by its owner. These boundaries prevent claiming all native or release findings resolved.

## Final candidate receipt

Final source snapshot after attribution correction: `037c49989fd18e3d50fae0f6484f43eadac92ff5cf79b57807fbe9bc414f1906`, 471 app/config/native inputs (`native/source-fingerprint.json`). Base HEAD remains50b2223e3ee058618bc23db48a97fb9fafac41ee; the fingerprint includes dirty source. Final supported export completed and was reinstalled/launched on the same isolated simulator app. `native/ios-final-route-bundle.log`, `native/ios-runtime-final-route-recheck.log` and `native/ios-final-launch.png` establish final candidate cold launch to Home without observed JS fatal.

Artifact manifest fingerprint: `4189e390089529562b16e0dbb8ed7fa8f9300e7a0d7f0f519a7854d7863aa41c`. Native executable SHA256: `9c357156b0a28d10d084e16cee2da18a88a917ef7a4789d10ac7166b7a7f4b06`; final main.jsbundle SHA256: `c59c5ba66e1da6555dbce595179ed5d5b9e6544142b65b5133e771a6dc4f7e61`. Full per-file hashes: `native/artifact-fingerprint.json`.

Final attribution rendered retest remains OPEN: immediately after reinstall Device Hub's CUA adapter returned `cgWindowNotFound` for both official app path and bundle ID, also after a fresh REPL binding. The simulator itself remains running and its screenshot shows healthy Home; this is a host UI connection blocker. The preceding primary journey and keyboard test passed before the attribution-only fixture correction. The independent47-test attribution regression passes, but it is not promoted to native rendered verification.

Post-candidate source delta: final browser QA required guarding account-reset export cleanup with `Platform.OS !== "web"` in `src/store/useSessionStore.ts`. This preserves the native cleanup branch but changes source bytes after the candidate receipt above. A Sprint9 source-contract assertion was also corrected. The native candidate is therefore not an exact match for the final whole-source fingerprint; no repeat native behavior claim is made for these later changes.
