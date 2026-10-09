import QtQuick
import qs.Commons

// Light's compact icon-only Button. It inherits Omarchy's normal focus,
// hover, pressed, tooltip, and keyboard behavior.
PixelButton {
  id: root

  property string pixelIconName: "close"

  iconText: ""
  implicitWidth: Math.max(
    root.pixelIconName === "close" ? Style.space(24) : Style.spacing.controlHeight,
    root.pixelIconName === "close" ? 0
      : root.iconSize + root.horizontalPadding * 2 + Math.max(2, Style.normalBorderWidth * 2)
  )
  implicitHeight: Math.max(
    root.pixelIconName === "close" ? Style.space(24) : Style.spacing.controlHeight,
    root.pixelIconName === "close" ? 0
      : root.iconSize + root.verticalPadding * 2 + Math.max(2, Style.normalBorderWidth * 2)
  )

  PixelIcon {
    anchors.centerIn: parent
    width: root.iconSize
    height: root.iconSize
    name: root.pixelIconName
    color: root.selected || root.active
      ? Style.selectedStateColor(root.foreground, root.accent)
      : root.foreground
    accentColor: root.accent
    opacity: root.enabled ? 1 : 0.36
  }
}
