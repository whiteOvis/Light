pragma ComponentBehavior: Bound
import QtQuick
import qs.Commons

// Compact transient scrollbar shared by the Bible reader and dense in-panel
// lists. It stays out of the way until scrolling begins, while retaining a
// full-height pointer target for direct dragging.
Item {
  id: root

  required property Flickable flickable
  property color foreground: LightPalette.muted
  property int hideDelay: 900
  property bool indicatorActive: false
  readonly property bool overflowing: flickable.contentHeight > flickable.height

  width: Style.space(8)
  visible: flickable.visible && overflowing
  enabled: indicatorActive || scrollbarMouse.pressed
  opacity: indicatorActive || scrollbarMouse.pressed ? 1 : 0
  z: 12

  Behavior on opacity { NumberAnimation { duration: 180 } }

  function reveal() {
    if (!overflowing) return
    indicatorActive = true
    hideTimer.restart()
  }

  Rectangle {
    id: scrollThumb
    anchors.horizontalCenter: parent.horizontalCenter
    width: Math.max(2, Style.normalBorderWidth * 2)
    height: Math.max(
      Style.space(24),
      root.height * Math.min(1, root.flickable.height / root.flickable.contentHeight)
    )
    y: {
      var maximum = Math.max(0, root.flickable.contentHeight - root.flickable.height)
      var travel = Math.max(0, root.height - height)
      return maximum > 0
        ? travel * (root.flickable.contentY - root.flickable.originY) / maximum
        : 0
    }
    radius: 0
    color: root.foreground
    opacity: 0.82
  }

  MouseArea {
    id: scrollbarMouse
    anchors.fill: parent
    cursorShape: Qt.PointingHandCursor

    function moveTo(pointerY) {
      var travel = Math.max(1, height - scrollThumb.height)
      var thumbPosition = Math.max(
        0,
        Math.min(travel, pointerY - scrollThumb.height / 2)
      )
      var maximum = Math.max(0, root.flickable.contentHeight - root.flickable.height)
      root.flickable.contentY = root.flickable.originY
        + maximum * thumbPosition / travel
      root.reveal()
    }

    onPressed: function(mouse) { moveTo(mouse.y) }
    onPositionChanged: function(mouse) {
      if (pressed) moveTo(mouse.y)
    }
    onReleased: hideTimer.restart()
  }

  Connections {
    target: root.flickable
    function onContentYChanged() { root.reveal() }
  }

  Timer {
    id: hideTimer
    interval: root.hideDelay
    onTriggered: {
      if (scrollbarMouse.pressed) restart()
      else root.indicatorActive = false
    }
  }
}
