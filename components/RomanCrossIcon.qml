import QtQuick
import qs.Commons
import qs.Commons as Commons

// Light's lighter geometric Latin cross from before the pixel-art redesign.
// Smooth rectangles keep the identity mark independent of icon fonts.
Item {
  id: root

  property color color: Commons.Color.bar.text
  property real stemWidthRatio: 0.165
  property real crossbarYRatio: 0.34

  readonly property real stemWidth: Math.max(2, Math.round(width * stemWidthRatio))
  readonly property real crossbarHeight: stemWidth

  Rectangle {
    width: root.stemWidth
    height: Math.max(root.stemWidth, Math.round(root.height * 0.82))
    anchors.horizontalCenter: parent.horizontalCenter
    anchors.verticalCenter: parent.verticalCenter
    radius: Math.max(0.5, width * 0.12)
    color: root.color
  }

  Rectangle {
    width: Math.max(root.stemWidth, Math.round(root.width * 0.72))
    height: root.crossbarHeight
    anchors.horizontalCenter: parent.horizontalCenter
    y: Math.round(root.height * root.crossbarYRatio - height / 2)
    radius: Math.max(0.5, height * 0.12)
    color: root.color
  }

  Behavior on color {
    ColorAnimation { duration: 160 }
  }
}
