import QtQuick
import qs.Commons

Rectangle {
  id: root
  readonly property bool inputActive: input.activeFocus
  property alias text: input.text
  property alias maximumLength: input.maximumLength
  property string placeholderText: ""
  property real fontSize: Style.font.body
  property real verticalPadding: Style.spacing.controlPaddingY
  property color backgroundColor: LightPalette.popupBackground
  property color foreground: LightPalette.popupText
  property color muted: LightPalette.muted
  property color borderColor: LightPalette.popupBorder
  property color accent: LightPalette.accent
  signal accepted()
  implicitHeight: Math.max(Style.spacing.controlHeight, fontSize + verticalPadding * 2)
  color: root.backgroundColor
  border.color: input.activeFocus ? root.accent : root.borderColor
  border.width: Style.normalBorderWidth
  radius: 0
  gradient: Gradient {
    GradientStop { position: 0; color: Qt.darker(root.backgroundColor, 1.16) }
    GradientStop { position: 1; color: root.backgroundColor }
  }
  Rectangle {
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    anchors.margins: Math.max(1, Style.normalBorderWidth)
    height: 1
    color: Util.alpha(root.inputActive ? root.accent : root.foreground,
      root.inputActive ? 0.65 : 0.12)
    Behavior on color { ColorAnimation { duration: 120 } }
  }
  TextInput {
    id: input
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.top: parent.top
    anchors.bottom: parent.bottom
    anchors.leftMargin: Style.spacing.controlPaddingX
    anchors.rightMargin: Style.spacing.controlPaddingX
    anchors.topMargin: root.verticalPadding
    anchors.bottomMargin: root.verticalPadding
    color: root.foreground
    selectionColor: Util.alpha(root.accent, 0.35)
    selectedTextColor: root.foreground
    font.family: Style.font.family
    font.pixelSize: root.fontSize
    verticalAlignment: TextInput.AlignVCenter
    selectByMouse: true
    clip: true
    activeFocusOnTab: true
    Accessible.name: root.placeholderText
    onAccepted: root.accepted()
    Text {
      anchors.fill: parent
      verticalAlignment: Text.AlignVCenter
      visible: input.text === ""
      text: root.placeholderText
      color: root.muted
      font: input.font
      elide: Text.ElideRight
    }
  }
}
