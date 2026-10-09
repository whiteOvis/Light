import QtQuick
import QtQuick.Controls as QQC
import qs.Commons
import qs.Ui

// Main dropdown frame. Child items are placed in the scrollable content
// column, making this a stable wrapper around the evolving application UI.
Item {
  id: root

  default property alias content: contentColumn.data
  property string title: "Application"
  property string subtitle: ""
  property bool showHeader: true
  property real appScale: 1.2

  LightTypography {
    id: typography
    appScale: root.appScale
  }

  readonly property color foreground: LightPalette.popupText
  readonly property color muted: LightPalette.muted
  readonly property color accent: LightPalette.accent
  readonly property real contentWidth: contentColumn.width
  readonly property real contentHeight: viewport.height

  function scrollBy(delta) {
    var maximum = Math.max(0, viewport.contentHeight - viewport.height)
    viewport.contentY = Math.max(0, Math.min(maximum, viewport.contentY + delta))
  }

  Column {
    id: header
    visible: root.showHeader
    height: visible ? implicitHeight : 0
    anchors.top: parent.top
    anchors.left: parent.left
    anchors.right: parent.right
    spacing: typography.labelGap

    Row {
      width: parent.width
      spacing: typography.controlGap

      RomanCrossIcon {
        width: Style.font.display
        height: Style.font.display
        color: root.accent
        anchors.verticalCenter: parent.verticalCenter
      }

      Column {
        width: Math.max(1, parent.width - Style.font.display - parent.spacing)
        anchors.verticalCenter: parent.verticalCenter
        spacing: typography.labelGap

        Text {
          width: parent.width
          text: root.title
          color: root.foreground
          font.family: Style.font.family
          font.pixelSize: typography.title
          font.bold: true
          elide: Text.ElideRight
        }

        Text {
          width: parent.width
          visible: text !== ""
          text: root.subtitle
          color: root.muted
          font.family: Style.font.family
          font.pixelSize: typography.caption
          elide: Text.ElideRight
        }
      }
    }

    PanelSeparator {
      width: parent.width
    }
  }

  Flickable {
    id: viewport
    anchors.top: root.showHeader ? header.bottom : parent.top
    anchors.topMargin: root.showHeader ? typography.panelGap : 0
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    contentWidth: width
    contentHeight: contentColumn.implicitHeight
    clip: true
    boundsBehavior: Flickable.StopAtBounds
    flickableDirection: Flickable.VerticalFlick
    interactive: contentHeight > height

    QQC.ScrollBar.vertical: OmarchyScrollBar {
      policy: viewport.contentHeight > viewport.height
        ? QQC.ScrollBar.AsNeeded
        : QQC.ScrollBar.AlwaysOff
      foreground: root.foreground
      accent: root.accent
    }

    Column {
      id: contentColumn
      width: Math.max(1, viewport.width - Style.spacing.controlGap)
      spacing: typography.panelGap
    }
  }
}
