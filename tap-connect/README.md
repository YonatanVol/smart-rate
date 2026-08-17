# Tap Connect

A home-screen icon that connects your Bluetooth earphones. One tap, no Settings, no Bluetooth
device list, no switch. Built for a Samsung One UI home screen and a pair of Technics EAZ100, but
it works with any bonded audio device you pick.

Tapping the icon draws nothing at all — it shows a toast, connects, and gets out of the way.

## Why an app and not a web page

Web Bluetooth only speaks BLE GATT. It cannot pair or connect the A2DP/HFP audio profiles that
earphones use, and Samsung Internet/Chrome will not let a page do it under any flag. Connecting a
headset is an Android-side operation, so the one-tap thing has to be a launcher item.

## How the connect actually happens

Android has no public "connect this headset" API. `BluetoothA2dp.connect()` and its siblings are
hidden, and since Android 11 they are guarded by `BLUETOOTH_PRIVILEGED`, which only system apps
hold. So [`BtConnector`](app/src/main/java/com/yonatan/tapconnect/BtConnector.kt) walks a ladder and
stops at the first rung that sticks:

1. reflective `connect(device)` on the A2DP and HFP profile proxies,
2. reflective `BluetoothDevice.connect()` and `BluetoothAdapter.connectAllEnabledProfiles(device)`,
3. an SDP query plus an RFCOMM socket attempt on the Handsfree UUID. The socket is expected to be
   refused — the Bluetooth stack owns that channel — but the attempt forces an ACL (baseband) link,
   and headsets that see an incoming link almost always initiate A2DP/HFP themselves. This rung
   needs no privileged API, which is why it is the one that carries most devices.

After each rung it polls the profile connection state, so the toast tells you what really happened:

| Toast | Meaning |
| --- | --- |
| `EAZ100 connected` | verified — a profile reported `STATE_CONNECTED` |
| `EAZ100 is already connected` | nothing to do |
| `Waking EAZ100 — it should connect in a moment` | the radio link is up, the earbuds are finishing it (usually a second or two) |
| `Could not connect EAZ100` | everything errored; Bluetooth settings opens so you can finish by hand |

If Bluetooth is off, it asks the system to turn it on and then continues — Android 13+ does not let
apps flip the radio silently.

## Install

No Android Studio needed. Every push that touches `tap-connect/**` builds a debug APK in CI
(`.github/workflows/tap-connect-apk.yml`, at the repository root — GitHub only reads workflows from
there):

1. Open the repo's **Actions** tab → the latest **Build APK** run → download the
   `tap-connect-debug-apk` artifact.
2. Unzip it on your phone and open `app-debug.apk`. One UI will ask to allow installing unknown
   apps for whichever app you opened it from — allow it.
3. Launch **Tap Connect** once. Grant **Nearby devices** when asked.
4. If your EAZ100 is already paired, the first tap finds it by name and connects. Otherwise a
   picker appears — choose it once and it is remembered.

Building locally instead: `./gradlew assembleDebug` with the Android SDK installed
(`platforms;android-35`, `build-tools;35.0.0`).

## Put it on the home screen

- **App icon** — Apps screen → long-press **Tap Connect** → **Add to Home**. That icon *is* the
  one-click button.
- **Widget** — long-press the home screen → **Widgets** → **Tap Connect**. A 1×1 button that shows
  the saved device's name. Same behaviour, just labelled.
- **Change device later** — long-press the icon → **Choose device**.

The earphones must already be paired once in Bluetooth settings; this app connects bonded devices,
it does not pair new ones.

## If a tap only ever says "Waking…"

That means your firmware blocks the privileged calls and the ACL nudge is doing the work. It is
normally enough. If your EAZ100 stays unconnected after a few seconds:

- Take them out of the case first — buds asleep in a closed case ignore an incoming link.
- Make sure they are not connected to another device (multipoint holds the A2DP slot).
- Check `adb logcat -s TapConnect` to see which rungs were rejected.
- Samsung's own **Modes and Routines** can also drive a Bluetooth connect action on recent One UI
  versions, and routines can be pinned to the home screen — worth a try as a no-code fallback if
  your firmware is unusually locked down.

## Layout

```
app/src/main/java/com/yonatan/tapconnect/
  ConnectActivity.kt      invisible launcher activity: permission, radio, toast, done
  BtConnector.kt          the connect ladder and state polling
  DevicePickerActivity.kt one-time bonded-device picker
  ConnectWidget.kt        optional 1x1 home-screen widget
  Prefs.kt                saved device address/name
```

No third-party dependencies — framework Bluetooth APIs and Kotlin stdlib only. minSdk 26,
targetSdk 35.

## Why it lives inside the smart-rate repo

It has nothing to do with the Next.js app here. It landed in this directory because the session that
wrote it could not create a GitHub repository (`403 Resource not accessible by integration`), and
`smart-rate` was the only repo it could push to. To lift it into its own repo later, with history:

```bash
git subtree split -P tap-connect -b tap-connect-only
git push git@github.com:<you>/tap-connect.git tap-connect-only:main
```

Then move `.github/workflows/tap-connect-apk.yml` to that repo's root, drop the `paths:` filters and
the `tap-connect` working directory, and delete this directory here.
