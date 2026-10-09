import QtQuick
import qs.Commons
import qs.Ui

// Retains Omarchy's complete Button behavior while giving Light controls the
// precise square silhouette used by its controls and radio artwork.
Button {
  id: root
  foreground: LightPalette.popupText
  accent: LightPalette.accent
  tooltipBackground: LightPalette.popupBackground
  tooltipForeground: LightPalette.popupText
  tooltipBorder: LightPalette.popupBorder
  radius: 0
  // Give shared controls a shallow raised face while retaining the shell's
  // focus, pressed, selected and hover state colors and hit targets.
  gradient: Gradient {
    GradientStop {
      position: 0
      color: Qt.tint(root.color, Util.alpha(root.foreground,
        root.enabled && (root.bordered || root.hot || root.selected) ? 0.065 : 0))
    }
    GradientStop { position: 1; color: root.color }
  }

  Rectangle {
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    anchors.margins: Math.max(1, Style.normalBorderWidth)
    height: 1
    visible: root.enabled && (root.bordered || root.selected || root.active)
    color: Util.alpha(root.selected || root.active ? root.accent : root.foreground, 0.28)
  }
}
