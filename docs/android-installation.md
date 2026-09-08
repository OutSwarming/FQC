# Android installation review — September 8, 2026

FQC is a browser-installed PWA. This repository contains no Android APK, Gradle project, or AndroidManifest.xml. Its web manifest cannot specify Android targetSdkVersion. Do not add invented SDK fields to manifest.webmanifest or tell users to bypass Play Protect.

The user confirmed the warning occurred during Samsung Internet installation. A matching first-hand report is open in Samsung's support tracker. Its proposed exact SDK cause is a hypothesis, not a verified finding for the FQC package. Inspect the generated package on the affected device to establish its actual SDK level.

- Samsung report: https://github.com/SamsungInternet/support/issues/123
- Browser-generated Android packages and runtime permissions: https://web.dev/articles/webapks
- Current Google Play submission requirements: https://developer.android.com/google/play/requirements/target-sdk

As of August 31, 2026, new mobile apps and updates submitted to Google Play must target Android 16 / API 36. This Play submission rule is distinct from the minimum SDK threshold used to block old installations. FQC does not currently distribute a Play Store APK.

Release 2.26.4 offers Samsung Internet users installation through an updated Chrome browser instead of invoking Samsung's deferred installer. It preserves browsing without installation and does not disable device protection. Updating the website does not rebuild or repair an already-generated Samsung package. Physical Samsung/Play Protect verification remains necessary; the browser guidance tests do not simulate native installation.

The same release explicitly denies camera and microphone access with Permissions-Policy, retains same-origin geolocation and passkeys, and restricts the service worker's offline cache to public /assets/ responses. Private/no-store responses are excluded; navigation stays network-only. Changing the cache name clears the prior FQC asset cache during activation. Firebase account/attendance requests remain cross-origin and are not cached by this worker.

Checks: node --test tests/service-worker.test.mjs; installation UI checks on desktop and simulated phones; production header and browser permission-policy inspection. These changes are not a certification of complete Android or legal compliance.
