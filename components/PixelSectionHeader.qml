import QtQuick
import qs.Commons

// A restrained pixel treatment for section titles: one accent tile and a
// stepped rule provide hierarchy while the text remains clean and familiar.
Item {
  id: root

  property string text: ""
  property real fontSize: Style.font.bodySmall
  property color foreground: LightPalette.popupText
  property color accent: LightPalette.accent

  implicitWidth: accentTile.width + Style.spacing.xs + sectionLabel.implicitWidth
    + Style.spacing.controlGap + endCap.width
  implicitHeight: Math.max(sectionLabel.implicitHeight, Style.space(12))

  Rectangle {
    id: accentTile
    anchors.left: parent.left
    anchors.verticalCenter: parent.verticalCenter
    width: Math.max(3, Math.round(root.fontSize * 0.28))
    height: Math.max(width, root.fontSize * 0.75)
    color: root.accent
    radius: 0
  }

  Text {
    id: sectionLabel
    anchors.left: accentTile.right
    anchors.leftMargin: Style.spacing.xs
    anchors.verticalCenter: parent.verticalCenter
    width: root.width <= root.implicitWidth + 1
      ? implicitWidth
      : Math.min(implicitWidth, Math.max(1, parent.width * 0.72))
    text: root.text
    color: root.foreground
    font.family: Style.font.family
    font.pixelSize: root.fontSize
    font.bold: true
    font.letterSpacing: 0.35
    elide: Text.ElideRight
  }

  Rectangle {
    anchors.left: sectionLabel.right
    anchors.leftMargin: Style.spacing.controlGap
    anchors.right: endCap.left
    anchors.rightMargin: Style.spacing.xs
    anchors.verticalCenter: parent.verticalCenter
    height: Math.max(1, Style.normalBorderWidth)
    color: Util.alpha(root.foreground, 0.26)
    gradient: Gradient {
      orientation: Gradient.Horizontal
      GradientStop { position: 0; color: Util.alpha(root.accent, 0.4) }
      GradientStop { position: 1; color: Util.alpha(root.foreground, 0.08) }
    }
  }

  Rectangle {
    id: endCap
    anchors.right: parent.right
    anchors.verticalCenter: parent.verticalCenter
    width: Math.max(2, Math.round(root.fontSize * 0.2))
    height: width
    color: Util.alpha(root.accent, 0.72)
    radius: 0
  }
}
