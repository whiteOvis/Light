pragma ComponentBehavior: Bound
import QtQuick
import qs.Commons
import qs.Commons as Commons

// Compact analog instrumentation for the reel deck. The needle uses a smooth
// transition while the housing, scale, and shading stay on the pixel grid.
Item {
  id: root

  property string label: "VU"
  property string readout: "0"
  property real value: 0
  property bool active: false
  property color foreground: Commons.Color.popups.text
  property color muted: Commons.Color.muted
  property color accent: Commons.Color.accent
  property color faceColor: Util.alpha(accent, active ? 0.1 : 0.045)
  property color housingColor: Qt.darker(Commons.Color.popups.background, 1.12)
  readonly property real clampedValue: Math.max(0, Math.min(1, value))
  readonly property real pixel: Math.max(1, Math.round(height / 32))

  implicitWidth: Style.space(105)
  implicitHeight: Style.space(62)

  Rectangle {
    anchors.fill: parent
    color: root.housingColor
    border.color: root.muted
    border.width: root.pixel * 2
    radius: 0

    Rectangle {
      anchors.fill: parent
      anchors.margins: root.pixel * 4
      color: root.faceColor
      border.color: Util.alpha(root.foreground, 0.24)
      border.width: root.pixel
      radius: 0
    }

    Rectangle {
      anchors.top: parent.top
      anchors.left: parent.left
      anchors.margins: root.pixel * 2
      width: parent.width - root.pixel * 4
      height: root.pixel
      color: Util.alpha(root.foreground, 0.26)
    }

    Repeater {
      model: 7
      delegate: Rectangle {
        id: meterTick
        required property int index
        x: root.width * 0.2 + meterTick.index * root.width * 0.1
        y: root.height * (0.34 - Math.abs(3 - meterTick.index) * 0.018)
        width: root.pixel
        height: meterTick.index === 0 || meterTick.index === 6 ? root.pixel * 4 : root.pixel * 3
        color: meterTick.index >= 5 ? root.accent : root.muted
        rotation: -30 + meterTick.index * 10
        radius: 0
      }
    }

    Text {
      anchors.top: parent.top
      anchors.topMargin: root.pixel * 3
      anchors.left: parent.left
      anchors.leftMargin: root.pixel * 5
      text: root.label
      color: root.foreground
      font.family: Style.font.family
      font.pixelSize: Math.max(Style.space(7), root.height * 0.17)
      font.bold: true
    }

    Text {
      anchors.top: parent.top
      anchors.topMargin: root.pixel * 3
      anchors.right: parent.right
      anchors.rightMargin: root.pixel * 5
      text: root.readout
      color: root.active ? root.accent : root.muted
      font.family: Style.font.family
      font.pixelSize: Math.max(Style.space(6), root.height * 0.14)
      font.bold: true
    }

    Item {
      id: needle
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.bottom: parent.bottom
      anchors.bottomMargin: root.pixel * 5
      width: root.pixel * 2
      height: parent.height * 0.53
      rotation: -48 + root.clampedValue * 96
      transformOrigin: Item.Bottom

      Rectangle {
        anchors.fill: parent
        color: root.active ? root.accent : root.muted
        radius: 0
      }

      Behavior on rotation {
        NumberAnimation { duration: 125; easing.type: Easing.OutCubic }
      }
    }

    Rectangle {
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.bottom: parent.bottom
      anchors.bottomMargin: root.pixel * 3
      width: root.pixel * 6
      height: root.pixel * 4
      color: root.foreground
      border.color: Commons.Color.background
      border.width: root.pixel
      radius: 0
    }
  }
}
