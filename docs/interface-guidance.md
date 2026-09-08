# FQC interface update · 2.18.0

Applied Apple’s official Human Interface Guidelines to the existing web app:

- Color: https://developer.apple.com/design/human-interface-guidelines/color
- Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Map gesture direction: https://support.apple.com/guide/iphone/learn-basic-gestures-iph75e97af9b/ios

Neutral semantic surfaces and labels, a consistent blue action color, distinct success/error feedback, light/dark/system appearance, higher contrast and reduced transparency variants. Glass is limited to the floating navigation. This is a CSS approximation, not native UIKit Liquid Glass.

The header has one labeled Settings control. Profile lives in the bottom tab bar. Appearance lives in Settings, and Done returns to the screen where Settings was opened. Installation help is collapsed. Landing CTAs use the same primary style and a direct interest-list label.

The map retains the existing pin selection and event popup. Mouse double-click/Shift-double-click, wheel, pinch, double tap and double-tap-hold-drag are enabled. Upward one-finger dragging zooms in, downward dragging zooms out. Immediate zoom avoids dropping reversals during Leaflet transitions. Short landscape touchscreens use the existing event sheet pattern.

Validation: existing app regression suite, plus `npm run test:phones` for iPhone SE, iPhone 13, large iPhone and landscape using WebKit; Pixel 7 using Chromium. Native double taps and mouse zoom are exercised across those emulated layouts. Continuous raw touch gestures (pinch and one-finger drag) use Chromium device input; WebKit cases for those two tests are intentionally skipped. No physical phone testing was performed.
