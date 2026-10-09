pragma Singleton
import QtQuick
import qs.Commons

QtObject {
  id: palette
  property bool nightMode: false
  property real textBrightness: 1

  function dimText(colorValue, surface) {
    var amount = Math.max(0.2, Math.min(1, textBrightness))
    return Qt.rgba(surface.r + (colorValue.r - surface.r) * amount,
      surface.g + (colorValue.g - surface.g) * amount,
      surface.b + (colorValue.b - surface.b) * amount, colorValue.a)
  }

  readonly property color baseForeground: nightMode ? "#ffffff" : Color.foreground
  readonly property color baseMuted: nightMode ? "#ffffff" : Color.muted
  readonly property color baseAccent: nightMode ? "#ffffff" : Color.accent
  readonly property color baseUrgent: nightMode ? "#ffffff" : Color.urgent
  readonly property color baseBibleText: nightMode ? "#ffffff" : Color.popups.text
  readonly property color basePopupText: nightMode ? "#ffffff" : Color.popups.text
  readonly property color background: nightMode ? "#000000" : Color.background
  readonly property color foreground: dimText(baseForeground, popupBackground)
  readonly property color muted: dimText(baseMuted, popupBackground)
  readonly property color accent: dimText(baseAccent, popupBackground)
  readonly property color urgent: dimText(baseUrgent, popupBackground)
  readonly property color bibleText: dimText(baseBibleText, popupBackground)
  readonly property color popupBackground: nightMode ? "#000000" : Color.popups.background
  readonly property color popupText: dimText(basePopupText, popupBackground)
  readonly property color popupBorder: nightMode ? "#292929" : Color.popups.border
}
