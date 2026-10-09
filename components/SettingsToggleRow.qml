import QtQuick
import qs.Commons
import qs.Ui

FocusScope {
  id: root

  property string title: ""
  property string helpText: ""
  property bool checked: false
  property color foreground: LightPalette.popupText
  property color muted: LightPalette.muted
  property color accent: LightPalette.accent
  property real bodyFontSize: Style.font.body
  property real captionFontSize: Style.font.caption
  property real controlGap: Style.spacing.controlGap

  signal toggleRequested(bool checked)

  width: parent ? parent.width : implicitWidth
  implicitHeight: Math.max(copy.implicitHeight, toggleSwitch.implicitHeight)
  activeFocusOnTab: true

  Accessible.role: Accessible.CheckBox
  Accessible.name: title
  Accessible.checked: checked

  function toggle() {
    root.forceActiveFocus()
    root.toggleRequested(!root.checked)
  }

  Keys.onReturnPressed: root.toggle()
  Keys.onEnterPressed: root.toggle()
  Keys.onSpacePressed: root.toggle()

  Rectangle {
    anchors.fill: parent
    color: Util.alpha(root.accent, root.activeFocus || hover.hovered ? 0.07 : 0)
    Behavior on color { ColorAnimation { duration: 120 } }
    Rectangle {
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      height: 1
      color: Util.alpha(root.foreground, 0.09)
    }
  }

  Column {
    id: copy
    anchors.left: parent.left
    anchors.right: toggleSwitch.left
    anchors.rightMargin: root.controlGap
    anchors.verticalCenter: parent.verticalCenter
    spacing: Style.spacing.xxs

    Text {
      width: parent.width
      text: root.title
      color: root.activeFocus || hover.hovered ? root.accent : root.foreground
      font.family: Style.font.family
      font.pixelSize: root.bodyFontSize
      font.bold: true
      elide: Text.ElideRight
    }

    Text {
      width: parent.width
      visible: root.helpText !== ""
      text: root.helpText
      color: root.muted
      font.family: Style.font.family
      font.pixelSize: root.captionFontSize
      wrapMode: Text.WordWrap
    }
  }

  ToggleSwitch {
    id: toggleSwitch
    anchors.right: parent.right
    anchors.verticalCenter: parent.verticalCenter
    trackHeight: Math.round(Math.max(22, Style.spacing.controlHeight * 0.55) * 0.75)
    rounded: false
    checked: root.checked
    interactive: false
    cursorRing: false
    foreground: root.foreground
    accent: root.accent
  }

  HoverHandler { id: hover }

  MouseArea {
    anchors.fill: parent
    cursorShape: Qt.PointingHandCursor
    onClicked: root.toggle()
  }
}
