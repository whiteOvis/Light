pragma ComponentBehavior: Bound
import QtQuick
import qs.Commons
import qs.Ui

// A square-edged version of Omarchy's PanelSlider with the same public API.
// Stepped highlights add a restrained 16-bit treatment without changing its
// input behavior or value model.
Item {
  id: root

  property var bar: null
  property real value: 0
  property real minimum: 0
  property real maximum: 1
  property real step: 0.05
  property bool integer: false
  property color foreground: bar ? bar.foreground : LightPalette.popupText
  property color accent: LightPalette.accent
  property color background: bar ? bar.background : LightPalette.popupBackground
  property color trackColor: Style.normalFillFor(foreground, accent, LightPalette.urgent)
  property color fillColor: accent
  property color knobColor: foreground
  property bool dragging: false
  property real trackHeight: Math.max(4, Math.round(Style.spacing.controlHeight * 0.11))
  property real knobSize: Math.max(14, Math.round(Style.spacing.controlHeight * 0.38))
  property real liveValue: value
  property int tickCount: 0
  property color tickColor: background

  signal moved(real value)
  signal released(real value)
  signal rightClicked()

  implicitWidth: Style.space(200)
  implicitHeight: Math.max(Style.space(22), knobSize + Style.spacing.md)

  readonly property real range: Math.max(0.0001, maximum - minimum)
  readonly property real progress: Math.max(0, Math.min(1, (liveValue - minimum) / range))
  readonly property bool hot: sliderMouse.containsMouse || root.dragging

  onValueChanged: if (!dragging) liveValue = value

  Rectangle {
    id: track
    anchors.verticalCenter: parent.verticalCenter
    anchors.left: parent.left
    anchors.right: parent.right
    height: root.trackHeight
    color: root.trackColor
    radius: 0

    Rectangle {
      anchors.top: parent.top
      anchors.left: parent.left
      anchors.right: parent.right
      height: Math.max(1, parent.height * 0.24)
      color: Util.alpha(LightPalette.popupText, 0.16)
    }
  }

  Rectangle {
    anchors.verticalCenter: track.verticalCenter
    anchors.left: track.left
    height: track.height
    width: track.width * root.progress
    color: root.fillColor
    radius: 0

    Behavior on width {
      enabled: !root.dragging
      NumberAnimation { duration: 120; easing.type: Easing.OutCubic }
    }
  }

  Repeater {
    model: root.tickCount > 1 ? root.tickCount : 0
    delegate: Rectangle {
      id: tick
      required property int index
      width: Math.max(1, Style.space(2))
      height: root.trackHeight + Style.space(4)
      color: root.tickColor
      anchors.verticalCenter: track.verticalCenter
      x: Math.max(0, Math.min(
        track.width - width,
        track.width * (tick.index / (root.tickCount - 1)) - width / 2
      ))
      radius: 0
    }
  }

  BorderSurface {
    id: knob
    width: root.knobSize
    height: root.knobSize
    radius: 0
    color: root.knobColor
    gradient: Gradient {
      GradientStop { position: 0; color: Qt.lighter(root.knobColor, 1.12) }
      GradientStop { position: 1; color: Qt.darker(root.knobColor, 1.2) }
    }
    borderSpec: Border.flat(root.background, Math.max(1, Style.space(2)))
    anchors.verticalCenter: track.verticalCenter
    x: Math.max(0, Math.min(track.width - width, track.width * root.progress - width / 2))

    Rectangle {
      anchors.top: parent.top
      anchors.left: parent.left
      width: parent.width
      height: Math.max(1, Math.round(parent.height * 0.16))
      color: Util.alpha(LightPalette.popupText, root.hot ? 0.34 : 0.2)
    }

    Rectangle {
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      width: Math.max(1, Math.round(parent.width * 0.16))
      height: parent.height
      color: Util.alpha(LightPalette.background, 0.46)
    }

    Behavior on x {
      enabled: !root.dragging
      NumberAnimation { duration: 120; easing.type: Easing.OutCubic }
    }
  }

  MouseArea {
    id: sliderMouse
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    acceptedButtons: Qt.LeftButton | Qt.RightButton

    function valueFromX(positionX) {
      var clamped = Math.max(0, Math.min(track.width, positionX))
      var raw = root.minimum + (clamped / track.width) * root.range
      if (root.integer) raw = Math.round(raw)
      return Math.max(root.minimum, Math.min(root.maximum, raw))
    }

    onPressed: function(mouse) {
      if (mouse.button !== Qt.LeftButton) return
      root.dragging = true
      var next = valueFromX(mouse.x)
      root.liveValue = next
      root.moved(next)
    }
    onClicked: function(mouse) {
      if (mouse.button === Qt.RightButton) root.rightClicked()
    }
    onPositionChanged: function(mouse) {
      if (!root.dragging) return
      var next = valueFromX(mouse.x)
      root.liveValue = next
      root.moved(next)
    }
    onReleased: function(mouse) {
      if (mouse.button !== Qt.LeftButton) return
      root.dragging = false
      root.released(root.liveValue)
      root.liveValue = root.value
    }
    onWheel: function(wheel) {
      var delta = wheel.angleDelta.y > 0 ? root.step : -root.step
      var next = Math.max(root.minimum, Math.min(root.maximum, root.liveValue + delta))
      if (root.integer) next = Math.round(next)
      root.liveValue = next
      root.moved(next)
      root.released(next)
    }
  }
}
