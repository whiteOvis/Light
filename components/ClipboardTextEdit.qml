import QtQuick

// Qt's plain-text TextEdit checks MIME metadata when the clipboard changes;
// affected TextInput builds fetch text automatically. Explicit paste also
// bypasses Qt's synchronous reader and uses the bounded backend transfer.
TextEdit {
  id: root
  property int maximumLength: 32767
  property bool singleLine: true
  property bool normalizing: false
  property int pasteGeneration: 0
  property var pasteTarget: null
  property string pasteError: ""
  signal accepted()
  textFormat: TextEdit.PlainText
  wrapMode: TextEdit.NoWrap
  selectByMouse: true

  function paste(primary) {
    if (readOnly) return
    pasteError = ""
    pasteGeneration++
    pasteTarget = { text: text, start: selectionStart, end: selectionEnd, cursor: cursorPosition }
    clipboardApi.post("/v1/clipboard/read", { primary: primary === true }, "clipboard:" + pasteGeneration)
  }

  function applyPaste(value) {
    var target = pasteTarget
    pasteTarget = null
    if (!target || readOnly || text !== target.text || cursorPosition !== target.cursor
        || selectionStart !== target.start || selectionEnd !== target.end) return
    var valueText = String(value || "")
    if (singleLine) valueText = valueText.replace(/[\r\n\u2028\u2029]+/g, " ")
    valueText = valueText.slice(0, Math.max(0, maximumLength - (length - (target.end - target.start))))
    // An empty clipboard or failed transfer must not erase a selection.
    if (valueText === "") return
    remove(target.start, target.end)
    insert(target.start, valueText)
    cursorPosition = target.start + valueText.length
  }

  onTextChanged: {
    if (normalizing) return
    normalizing = true
    if (length > maximumLength) remove(maximumLength, length)
    if (singleLine) {
      for (var i = 0; i < length; i++) {
        if (/[\r\n\u2028\u2029]/.test(getText(i, i + 1))) {
          remove(i, i + 1)
          insert(i, " ")
        }
      }
    }
    normalizing = false
  }
  onActiveFocusChanged: if (!activeFocus) {
    pasteGeneration++
    pasteTarget = null
  }
  Keys.priority: Keys.BeforeItem
  Keys.forwardTo: [pasteKeys]
  Keys.onPressed: function(event) {
    if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) {
      var forward = event.key !== Qt.Key_Backtab && !(event.modifiers & Qt.ShiftModifier)
      nextItemInFocusChain(forward).forceActiveFocus(forward ? Qt.TabFocusReason : Qt.BacktabFocusReason)
      event.accepted = true
      return
    }
    if (singleLine && (event.key === Qt.Key_Return || event.key === Qt.Key_Enter)) {
      accepted()
      event.accepted = true
    }
  }
  Item {
    id: pasteKeys
    Keys.onPressed: function(event) {
      if (event.matches(StandardKey.Paste)) {
        root.paste(false)
        event.accepted = true
      }
    }
  }
  MouseArea {
    anchors.fill: parent
    acceptedButtons: Qt.MiddleButton
    onClicked: function(mouse) {
      if (!root.readOnly) {
        root.forceActiveFocus()
        root.cursorPosition = root.positionAt(mouse.x, mouse.y)
        root.paste(true)
      }
    }
  }
  LightApi {
    id: clipboardApi
    onSucceeded: function(tag, payload, status) {
      if (tag === "clipboard:" + root.pasteGeneration) root.applyPaste(payload.text)
    }
    onFailed: function(tag, message, status, payload) {
      if (tag === "clipboard:" + root.pasteGeneration) {
        root.pasteTarget = null
        root.pasteError = message
      }
    }
  }
}
