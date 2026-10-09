pragma ComponentBehavior: Bound
import QtQuick
import qs.Commons

// A keyboard, wheel, and drag-adjustable studio knob with stepped pixel
// shading. Callers bind value and apply adjusted() to their state.
FocusScope {
  id: root

  property real value: 0
  property real minimum: 0
  property real maximum: 1
  property real step: 0.05
  property string label: "LEVEL"
  property color foreground: Color.popups.text
  property color muted: Color.muted
  property color accent: Color.accent
  property real minimumDialSize: Style.space(34)
  property real labelGap: Style.spacing.xxs
  property real dragStartY: 0
  property real dragStartValue: 0

  signal adjusted(real value)
  signal committed(real value)

  readonly property real range: Math.max(0.0001, maximum - minimum)
  readonly property real normalizedValue: Math.max(0, Math.min(1, (value - minimum) / range))
  readonly property real dialSize: Math.max(minimumDialSize, Math.min(width, height * 0.62))
  readonly property real pixel: Math.max(1, Math.round(dialSize / 30))

  activeFocusOnTab: true
  Accessible.role: Accessible.Slider
  Accessible.name: label

  function clamp(candidate) {
    return Math.max(minimum, Math.min(maximum, candidate))
  }

  function adjustBy(delta, commit) {
    var next = clamp(value + delta)
    adjusted(next)
    if (commit) committed(next)
  }

  Keys.onPressed: function(event) {
    if (event.key === Qt.Key_Up || event.key === Qt.Key_Right) {
      adjustBy(step, true)
      event.accepted = true
    } else if (event.key === Qt.Key_Down || event.key === Qt.Key_Left) {
      adjustBy(-step, true)
      event.accepted = true
    }
  }

  Text {
    id: knobLabel
    anchors.top: parent.top
    anchors.horizontalCenter: parent.horizontalCenter
    text: root.label
    color: root.muted
    font.family: Style.font.family
    font.pixelSize: Math.max(Style.space(7), root.dialSize * 0.16)
    font.bold: true
  }

  Item {
    id: dial
    anchors.top: knobLabel.bottom
    anchors.topMargin: root.labelGap
    anchors.horizontalCenter: parent.horizontalCenter
    width: root.dialSize
    height: width

    Repeater {
      model: 11
      delegate: Rectangle {
        id: dialTick
        required property int index
        readonly property real tickAngle: (-135 + dialTick.index * 27) * Math.PI / 180
        width: root.pixel * 2
        height: root.pixel * 3
        x: dial.width / 2 + Math.sin(tickAngle) * dial.width * 0.47 - width / 2
        y: dial.height / 2 - Math.cos(tickAngle) * dial.height * 0.47 - height / 2
        rotation: -135 + dialTick.index * 27
        color: dialTick.index <= Math.round(root.normalizedValue * 10) ? root.accent : root.muted
        opacity: dialTick.index <= Math.round(root.normalizedValue * 10) ? 1 : 0.42
        radius: 0
      }
    }

    Rectangle {
      anchors.centerIn: parent
      width: parent.width * 0.76
      height: width
      radius: width / 2
      antialiasing: false
      color: Qt.darker(Color.popups.background, 1.18)
      border.color: root.muted
      border.width: root.pixel * 2

      Rectangle {
        anchors.centerIn: parent
        width: parent.width * 0.72
        height: width
        radius: width / 2
        antialiasing: false
        color: Util.alpha(root.foreground, 0.12)
        border.color: Util.alpha(root.foreground, 0.28)
        border.width: root.pixel
      }

      Rectangle {
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.topMargin: parent.height * 0.18
        anchors.leftMargin: parent.width * 0.2
        width: parent.width * 0.38
        height: root.pixel * 2
        color: Util.alpha(root.foreground, 0.28)
        rotation: -24
        radius: 0
      }

      Item {
        anchors.centerIn: parent
        width: root.pixel * 2
        height: parent.height * 0.78
        rotation: -135 + root.normalizedValue * 270
        transformOrigin: Item.Center

        Rectangle {
          anchors.top: parent.top
          anchors.horizontalCenter: parent.horizontalCenter
          width: parent.width
          height: parent.height * 0.42
          color: root.accent
          radius: 0
        }

        Behavior on rotation {
          NumberAnimation { duration: 90; easing.type: Easing.OutCubic }
        }
      }
    }

    MouseArea {
      id: knobMouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.SizeVerCursor

      onPressed: function(mouse) {
        root.forceActiveFocus()
        root.dragStartY = mouse.y
        root.dragStartValue = root.value
      }
      onPositionChanged: function(mouse) {
        if (!pressed) return
        root.adjusted(root.clamp(root.dragStartValue + (root.dragStartY - mouse.y) / Math.max(40, dial.height) * root.range))
      }
      onReleased: root.committed(root.value)
      onWheel: function(wheel) {
        root.adjustBy((wheel.angleDelta.y >= 0 ? 1 : -1) * root.step, true)
        wheel.accepted = true
      }
    }
  }

  Text {
    id: valueLabel
    anchors.top: dial.bottom
    anchors.topMargin: root.labelGap
    anchors.horizontalCenter: parent.horizontalCenter
    text: Math.round(root.normalizedValue * 100) + "%"
    color: root.foreground
    font.family: Style.font.family
    font.pixelSize: Math.max(Style.space(7), root.dialSize * 0.15)
    font.bold: true
  }
}
