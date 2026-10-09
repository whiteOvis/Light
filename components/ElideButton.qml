import QtQuick
import qs.Commons

PixelButton {
  id: root
  property string fullText: ""
  property int elideMode: Text.ElideRight
  property real minimumHeight: Style.spacing.controlHeight
  text: ""
  tooltipText: fullText
  implicitWidth: label.implicitWidth + horizontalPadding * 2
  implicitHeight: Math.max(minimumHeight, label.implicitHeight + verticalPadding * 2)
  Accessible.name: fullText
  Text {
    id: label
    anchors.fill: parent
    anchors.leftMargin: root.horizontalPadding
    anchors.rightMargin: root.horizontalPadding
    text: root.fullText
    textFormat: Text.PlainText
    color: root.foreground
    font.family: Style.font.family
    font.pixelSize: root.fontSize
    verticalAlignment: Text.AlignVCenter
    horizontalAlignment: root.leftAlign ? Text.AlignLeft : Text.AlignHCenter
    elide: root.elideMode
  }
}
