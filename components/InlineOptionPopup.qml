pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls as QQC
import qs.Commons
import qs.Ui

QQC.Popup {
  id: root

  property var options: []
  property string value: ""
  property real rowHeight: Style.space(32)
  property real fontPixelSize: Style.font.bodySmall
  property int maxRows: 8
  property bool focusOnOpen: true
  property bool keyboardSelectionMoved: false
  property string emptyText: "No options"
  property color foreground: LightPalette.popupText
  property color accent: LightPalette.accent
  property var previewTexts: ({})

  signal selected(var option)
  signal visibleOptionsChanged(var options)

  function optionValue(option) {
    return option && typeof option === "object" ? String(option.value) : String(option)
  }

  function optionLabel(option) {
    if (!option || typeof option !== "object") return String(option)
    var preview = option.preview || root.previewTexts[option.previewKey] || ""
    return String(option.label) + (preview ? " - " + preview : "")
  }

  function reportVisibleOptions() {
    if (!opened) return
    var first = Math.max(0, Math.floor(optionList.contentY / rowHeight))
    var last = Math.min(options.length, Math.ceil((optionList.contentY + optionList.height) / rowHeight))
    visibleOptionsChanged(options.slice(first, last))
  }

  function indexOfValue(candidate) {
    for (var i = 0; i < options.length; i++) {
      if (optionValue(options[i]) === String(candidate)) return i
    }
    return options.length > 0 ? 0 : -1
  }

  function choose(index) {
    if (index < 0 || index >= options.length) return false
    selected(options[index])
    close()
    return true
  }

  function resetSelection() {
    optionList.currentIndex = indexOfValue(value)
    keyboardSelectionMoved = false
    if (optionList.currentIndex >= 0)
      optionList.positionViewAtIndex(optionList.currentIndex, ListView.Contain)
  }

  function moveSelection(delta) {
    if (optionList.count === 0) return false
    optionList.currentIndex = Math.max(
      0,
      Math.min(optionList.count - 1, optionList.currentIndex + delta)
    )
    keyboardSelectionMoved = true
    optionList.positionViewAtIndex(optionList.currentIndex, ListView.Contain)
    return true
  }

  function chooseCurrent() {
    return choose(optionList.currentIndex)
  }

  implicitHeight: Math.max(
    rowHeight,
    Math.min(options.length * rowHeight, rowHeight * maxRows)
  ) + padding * 2
  padding: Math.max(1, Style.normalBorderWidth)
  focus: focusOnOpen
  closePolicy: QQC.Popup.CloseOnEscape | QQC.Popup.CloseOnPressOutside

  background: BorderSurface {
    color: LightPalette.popupBackground
    gradient: Gradient {
      GradientStop { position: 0; color: LightPalette.nightMode ? "#000000" : Qt.tint(LightPalette.popupBackground, Util.alpha(LightPalette.popupText, 0.045)) }
      GradientStop { position: 1; color: LightPalette.popupBackground }
    }
    borderSpec: Border.localOrSurfaceSpec(
      "popups",
      "border",
      LightPalette.popupBorder,
      LightPalette.popupBorder,
      Style.normalBorderWidth
    )
    radius: 0
  }

  onOpened: {
    resetSelection()
    if (focusOnOpen) optionList.forceActiveFocus()
    Qt.callLater(reportVisibleOptions)
  }
  onClosed: visibleOptionsChanged([])
  onOptionsChanged: if (opened) {
    resetSelection()
    Qt.callLater(reportVisibleOptions)
  }

  contentItem: Item {
    ListView {
      id: optionList
      anchors.fill: parent
      clip: true
      boundsBehavior: Flickable.StopAtBounds
      model: root.options
      currentIndex: -1
      onContentYChanged: Qt.callLater(root.reportVisibleOptions)
      onHeightChanged: Qt.callLater(root.reportVisibleOptions)

      Keys.priority: Keys.BeforeItem
      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape) {
          root.close()
          event.accepted = true
        } else if (event.key === Qt.Key_Down) {
          event.accepted = root.moveSelection(1)
        } else if (event.key === Qt.Key_Up) {
          event.accepted = root.moveSelection(-1)
        } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter
                   || event.key === Qt.Key_Space) {
          event.accepted = root.chooseCurrent()
        }
      }

      QQC.ScrollBar.vertical: OmarchyScrollBar {
        policy: optionList.contentHeight > optionList.height
          ? QQC.ScrollBar.AsNeeded
          : QQC.ScrollBar.AlwaysOff
        foreground: root.foreground
        accent: root.accent
      }

      delegate: Rectangle {
        id: optionRow
        required property var modelData
        required property int index
        width: optionList.width
        height: root.rowHeight
        color: index === optionList.currentIndex
          ? Style.hoverFillFor(root.foreground, root.accent, LightPalette.urgent)
          : "transparent"

        Rectangle {
          anchors.left: parent.left
          anchors.top: parent.top
          anchors.bottom: parent.bottom
          width: Math.max(2, Style.normalBorderWidth * 2)
          visible: optionRow.index === optionList.currentIndex
          color: root.accent
          radius: 0
        }

        Text {
          objectName: "optionLabel-" + optionRow.index
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.leftMargin: Style.spacing.controlPaddingX
          anchors.rightMargin: Style.spacing.controlPaddingX
            + (optionList.contentHeight > optionList.height ? Style.space(10) : 0)
          anchors.verticalCenter: parent.verticalCenter
          text: root.optionLabel(optionRow.modelData)
          textFormat: Text.PlainText
          color: optionRow.index === optionList.currentIndex
            ? Style.hoverStateColor(root.foreground, root.accent, LightPalette.urgent)
            : root.foreground
          font.family: Style.font.family
          font.pixelSize: root.fontPixelSize
          wrapMode: Text.NoWrap
          maximumLineCount: 1
          elide: Text.ElideRight
        }

        MouseArea {
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onPositionChanged: optionList.currentIndex = optionRow.index
          onClicked: root.choose(optionRow.index)
        }
      }
    }

    Text {
      anchors.centerIn: parent
      visible: root.options.length === 0
      text: root.emptyText
      color: LightPalette.muted
      font.family: Style.font.family
      font.pixelSize: root.fontPixelSize
      width: parent.width - Style.spacing.controlPaddingX * 2
      wrapMode: Text.Wrap
      horizontalAlignment: Text.AlignHCenter
      elide: Text.ElideRight
      maximumLineCount: 2
    }
  }
}
