import QtQuick
import QtQuick.Controls as QQC
import qs.Commons

// Scrollbar using the same live Color and Style state tokens as Omarchy's
// controls. Theme changes propagate through these bindings immediately.
QQC.ScrollBar {
  id: root

  property color foreground: LightPalette.popupText
  property color accent: LightPalette.accent
  property bool hideWhenIdle: false

  minimumSize: 0.08
  padding: Style.spacing.xxs
  implicitWidth: Style.space(10)
  implicitHeight: Style.space(10)

  contentItem: Rectangle {
    implicitWidth: Style.space(5)
    implicitHeight: Style.space(5)
    radius: 0
    color: root.pressed
      ? Style.pressedStateColor(root.foreground, root.accent, LightPalette.urgent)
      : (root.hovered
        ? Style.hoverStateColor(root.foreground, root.accent, LightPalette.urgent)
        : Style.normalStateColor(root.foreground, root.accent, LightPalette.urgent))
    opacity: root.hideWhenIdle
      ? (root.active || root.pressed ? 0.9 : 0)
      : (root.active || root.hovered || root.pressed ? 0.9 : 0.48)

    Behavior on color { ColorAnimation { duration: 120 } }
    Behavior on opacity { NumberAnimation { duration: 120 } }
  }

  background: Rectangle {
    radius: 0
    color: Style.normalFillFor(root.foreground, root.accent, LightPalette.urgent)
    opacity: root.hideWhenIdle ? 0 : (root.active || root.hovered ? 1 : 0)

    Behavior on opacity { NumberAnimation { duration: 120 } }
  }
}
