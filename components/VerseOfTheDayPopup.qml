import QtQuick
import qs.Commons
import qs.Ui
import "PassageFormat.js" as PassageFormat
import "I18n.js" as I18n

Item {
  id: root
  objectName: "verseOfTheDayPopup"

  property bool opened: false
  property bool loading: false
  property var passage: ({})
  property string versionLabel: ""
  property string errorMessage: ""
  property string appLanguage: "en-US"
  property real appScale: 1.2
  property real textPixelSize: Style.font.body + Style.space(4)
  property string readerFontStyle: "youversion"

  LightTypography {
    id: typography
    appScale: root.appScale
  }

  readonly property real bodyPixelSize: typography.body
  readonly property real captionPixelSize: typography.caption
  readonly property color foreground: LightPalette.popupText
  readonly property color muted: LightPalette.muted
  readonly property color accent: LightPalette.accent
  readonly property string fontFamily: readerFontStyle === "system" ? Style.font.family : "Source Serif 4"
  readonly property string renderedPassage: PassageFormat.displayHtml(
    passage && passage.content ? String(passage.content) : "",
    textPixelSize, [], String(LightPalette.bibleText), fontFamily, false, ""
  )
  readonly property real outerMargin: typography.panelPadding
  readonly property real naturalCardHeight: content.childrenRect.height + typography.panelPadding * 2
  readonly property real preferredHeight: naturalCardHeight + outerMargin * 2

  signal closeRequested()
  signal refreshRequested()

  visible: opened
  z: 1100

  MouseArea {
    anchors.fill: parent
    onClicked: root.closeRequested()
  }

  Rectangle {
    id: card
    objectName: "verseOfTheDayCard"
    anchors.centerIn: parent
    width: Math.min(parent.width - root.outerMargin * 2, Style.space(520))
    height: Math.min(parent.height - root.outerMargin * 2, root.naturalCardHeight)
    color: LightPalette.popupBackground
    radius: 0

    MouseArea {
      anchors.fill: parent
      onClicked: function(mouse) { mouse.accepted = true }
    }

    Column {
      id: content
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.top: parent.top
      anchors.margins: typography.panelPadding
      spacing: typography.controlGap

      Text {
        objectName: "verseOfTheDayReference"
        width: parent.width
        visible: root.errorMessage === "" && root.renderedPassage !== ""
        text: root.passage && root.passage.reference
          ? String(root.passage.reference) + (root.versionLabel !== "" ? " (" + root.versionLabel + ")" : "")
          : ""
        color: root.accent
        font.family: Style.font.family
        font.pixelSize: root.bodyPixelSize
        font.bold: true
        horizontalAlignment: Text.AlignHCenter
      }

      TextEdit {
        objectName: "verseOfTheDayText"
        width: parent.width
        height: Math.max(root.textPixelSize * 1.25, contentHeight)
        visible: root.errorMessage === "" && root.renderedPassage !== ""
        text: root.renderedPassage
        textFormat: Text.RichText
        readOnly: true
        selectByMouse: true
        color: LightPalette.bibleText
        font.family: root.fontFamily
        font.pixelSize: root.textPixelSize
        wrapMode: Text.WordWrap
      }

      Text {
        width: parent.width
        visible: (root.loading && root.renderedPassage === "") || root.errorMessage !== ""
        text: root.loading && root.renderedPassage === "" ? I18n.t(root.appLanguage, "loading") : root.errorMessage
        color: root.loading && root.renderedPassage === "" ? root.muted : LightPalette.urgent
        font.family: Style.font.family
        font.pixelSize: root.bodyPixelSize
        wrapMode: Text.WordWrap
        horizontalAlignment: Text.AlignHCenter
      }

      Text {
        id: refreshLink
        objectName: "verseOfTheDayRefresh"
        width: parent.width
        text: I18n.t(root.appLanguage, "refreshVerseOfTheDay")
        color: root.loading ? root.muted : root.accent
        font.family: Style.font.family
        font.pixelSize: root.captionPixelSize
        font.underline: true
        horizontalAlignment: Text.AlignHCenter

        MouseArea {
          anchors.fill: parent
          enabled: !root.loading
          cursorShape: Qt.PointingHandCursor
          onClicked: root.refreshRequested()
        }
      }
    }
  }
}
