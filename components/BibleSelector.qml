import QtQuick
import qs.Commons
import qs.Commons as Commons
import "BibleData.js" as BibleData
import "I18n.js" as I18n
import "ShortcutUtils.js" as ShortcutUtils
import "PassageFormat.js" as PassageFormat

// Compact reference search with ordinary text editing and explicit submission.
Item {
  id: root

  property var keybindings: ({})
  property string serviceBaseUrl: "http://127.0.0.1:8788"
  property var searchOptions: []
  property string searchMessage: ""
  property int searchGeneration: 0
  property string nextSearchPage: ""
  property string nextLocalSearchPage: ""
  property var localSearchOptions: []
  property var onlineSearchOptions: []
  property bool searchLoading: false
  property bool localSearchLoading: false
  property var searchPreviews: ({})
  property var failedSearchPreviews: ({})
  property bool searchPreviewsLimited: false
  readonly property bool textSearch: browseMode === "" && bookInput.text.trim() !== ""
    && (/^text:/i.test(bookInput.text.trim())
      || (bookInputState.book && bookInputState.compound && bookInputState.chapter === ""
        && !/\d/.test(bookInput.text))
      || (!bookInputState.book && matchingBooks.length === 0))

  property var bookOptions: BibleData.bookOptions()
  property var versionOptions: BibleData.defaultVersionOptions()
  property var chapterOptionsOverride: []

  property string selectedBook: ""
  property string selectedChapter: ""
  property string selectedVersion: ""
  // The current passage lives in the tab and reference controls; this field is
  // reserved for a new search.
  property string versionQuery: ""
  property real textPixelSize: Style.font.body + Style.space(4)
  property string appLanguage: "en-US"
  property bool musicPlayerEnabled: false
  property bool autoOpenReferences: false
  property string browseMode: ""
  readonly property bool pickerMode: browseMode === "chapters" || browseMode === "versions"
  property bool editingQuery: false
  property string selectedVerse: ""
  property bool applyingLiveReference: false
  property string lastAutoReference: ""
  property Item actionContainer: null
  property real actionIconSize: 0
  readonly property real actionWidth: actionRow.implicitWidth

  readonly property alias inputItem: bookInput
  readonly property bool inputActive: bookInput.activeFocus
    || bookPopup.opened
    || (radioButton.visible && radioButton.activeFocus)
    || settingsButton.activeFocus
    || clearSearchButton.activeFocus

  readonly property var activeOptionsPopup: bookPopup.opened ? bookPopup : null
  readonly property real baseHeight: controlHeight
  readonly property real preferredHeight: activeOptionsPopup
    ? Math.max(baseHeight, commandBar.y + activeOptionsPopup.y + activeOptionsPopup.implicitHeight)
    : baseHeight
  readonly property var chapterOptions: chapterOptionsOverride.length > 0
    ? chapterOptionsOverride
    : localizedChapterOptions(BibleData.chapterOptions(selectedBook, bookOptions))
  readonly property var bookInputState: BibleData.parseReferenceInput(
    bookInput.text,
    bookOptions,
    versionOptions
  )
  readonly property var bookSuggestion: BibleData.autocompleteOption(
    bookOptions,
    bookInputState.bookQuery
  )
  readonly property bool compoundVersionSuggestions: bookInputState.book !== null
    && bookInputState.chapterValid
    && bookInputState.verseValid
  readonly property string bookGhostSuffix: compoundVersionSuggestions
    && bookInputState.versionQuery !== ""
      ? BibleData.autocompleteSuffix(bookInputState.version, bookInputState.versionQuery)
      : BibleData.autocompleteSuffix(bookSuggestion, bookInput.text)
  readonly property var matchingBooks: BibleData.filterOptions(
    bookOptions,
    bookInputState.bookQuery
  )
  readonly property var compoundVersions: referenceOptions()
  readonly property var matchingVersions: BibleData.filterOptions(versionOptions, bookInput.text)
  readonly property var matchingChapters: BibleData.filterOptions(chapterOptions, bookInput.text)
  readonly property color foreground: LightPalette.popupText
  readonly property color muted: LightPalette.muted
  readonly property color accent: LightPalette.accent
  readonly property real controlHeight: Math.max(
    Style.space(44),
    textPixelSize + Style.spacing.controlPaddingY * 2 + Style.space(2)
  )
  readonly property real optionRowHeight: Math.max(
    Style.space(32),
    textPixelSize + Style.spacing.controlPaddingY * 2
  )
  // Keep the two action marks proportionate to the selector's text while
  // preserving a readable size at the smallest supported text scale.
  readonly property real selectorTextReferenceSize: Style.font.body + Style.space(4)
  readonly property real selectorIconSize: actionIconSize > 0 ? actionIconSize : Math.max(
    Style.space(14),
    Math.round(Style.space(18) * textPixelSize / selectorTextReferenceSize)
  )
  readonly property real selectorIconButtonWidth: actionContainer
    ? selectorIconSize + Style.space(8) : Math.max(
    Style.space(30),
    selectorIconSize + Style.spacing.controlPaddingX * 2
  )

  signal selectionChanged(string book, string chapter, string version, bool showReader)
  signal verseRequested(string verse)
  signal settingsRequested()
  signal radioRequested()
  signal closeRequested()
  signal readingFocusRequested()
  signal readerScrollRequested(int direction)

  implicitHeight: preferredHeight

  function referenceOptions() {
    var parsed = bookInputState
    if (!parsed.book || !parsed.chapterValid || !parsed.verseValid) return []
    var candidates = parsed.versionQuery !== ""
      ? BibleData.filterOptions(versionOptions, parsed.versionQuery)
      : parsed.version ? [parsed.version] : versionOptions.slice()
    if (parsed.versionQuery === "" && !parsed.version) {
      candidates.sort(function(a, b) {
        return (optionValue(b) === selectedVersion ? 1 : 0)
          - (optionValue(a) === selectedVersion ? 1 : 0)
      })
    }
    return candidates.map(function(version) {
      return { value: optionValue(version), label: optionLabel(parsed.book)
        + " " + parsed.chapter + (parsed.verse ? ":" + parsed.verse : "")
        + " · " + optionLabel(version) }
    })
  }

  function applyLiveReference() {
    var parsed = bookInputState
    if (!autoOpenReferences || !bookInput.activeFocus || textSearch
        || !parsed.book || !parsed.chapterValid || !parsed.verseValid) return
    // Never navigate to a guessed translation while its name is unfinished.
    if (parsed.versionQuery !== "" && (!parsed.version
        || BibleData.prefixedOption([parsed.version],
          BibleData.normalizeReferenceText(parsed.versionQuery)).term
          !== BibleData.normalizeReferenceText(parsed.versionQuery))) return
    var version = parsed.version ? optionValue(parsed.version) : selectedVersion
    var key = optionValue(parsed.book) + ":" + parsed.chapter + ":" + parsed.verse + ":" + version
    if (key === lastAutoReference) return
    lastAutoReference = key
    applyingLiveReference = true
    selectedBook = optionValue(parsed.book)
    selectedChapter = parsed.chapter
    selectedVersion = version
    applyingLiveReference = false
    syncChapterText()
    syncVersionText()
    selectionChanged(selectedBook, selectedChapter, selectedVersion, true)
    if (parsed.verse) verseRequested(parsed.verse)
  }

  Timer {
    id: autoReferenceTimer
    objectName: "autoReferenceTimer"
    interval: 900
    onTriggered: root.applyLiveReference()
  }
  onAutoOpenReferencesChanged: if (!autoOpenReferences) autoReferenceTimer.stop()

  function refreshSearch() {
    searchGeneration += 1
    searchApi.cancelReads("search:")
    localSearchApi.cancelReads("local-search:")
    searchPreviewApi.cancelReads("search-preview:")
    if (Object.keys(searchPreviews).length > 256) searchPreviews = ({})
    failedSearchPreviews = ({})
    searchPreviewsLimited = false
    searchTimer.stop()
    searchOptions = []
    localSearchOptions = []
    onlineSearchOptions = []
    nextSearchPage = ""
    nextLocalSearchPage = ""
    searchLoading = false
    localSearchLoading = false
    searchMessage = textSearch ? I18n.t(root.appLanguage, "searchingVerses") : ""
    if (textSearch) searchTimer.restart()
  }

  function runSearch(page, more) {
    if (!textSearch) return
    if (!more || nextLocalSearchPage) {
      localSearchLoading = true
      localSearchApi.get("/v1/search?source=download&version=" + encodeURIComponent(selectedVersion)
        + "&query=" + encodeURIComponent(bookInput.text.trim())
        + "&page_token=" + encodeURIComponent(nextLocalSearchPage || ""),
        "local-search:" + searchGeneration)
    }
    if (!more || page) {
      searchLoading = true
      searchApi.get("/v1/search?version=" + encodeURIComponent(selectedVersion)
        + "&query=" + encodeURIComponent(bookInput.text.trim())
        + "&page_token=" + encodeURIComponent(page || ""), "search:" + searchGeneration)
    }
  }

  function updateSearchOptions() {
    var options = localSearchOptions.slice()
    var seen = ({})
    for (var i = 0; i < options.length; i++)
      if (options[i].reference) seen[options[i].previewKey] = true
    for (var j = 0; j < onlineSearchOptions.length; j++) {
      var option = onlineSearchOptions[j]
      if (!option.reference || !seen[option.previewKey]) options.push(option)
    }
    if (nextLocalSearchPage || nextSearchPage)
      options.push({ value: "more", more: true, label: I18n.t(appLanguage, "moreSearchResults") })
    searchOptions = options
    searchMessage = options.length || searchLoading || localSearchLoading
      ? "" : I18n.t(appLanguage, "noSearchResults")
  }

  function searchVerseOption(hit, version) {
    if (!/^[A-Z0-9]{3}\.\d+\.\d+$/.test(hit.reference)) return null
    var parts = hit.reference.split(".")
    var label = labelFor(bookOptions, parts[0]) + " " + parts[1] + ":" + parts[2]
    if (String(version) !== String(selectedVersion)) label += " · " + labelFor(versionOptions, version)
    return { value: hit.reference, reference: hit.reference, version: version,
      previewKey: version + ":" + hit.reference, label: label,
      preview: searchPreviewText(hit.text) }
  }

  LightApi {
    id: localSearchApi
    objectName: "localSearchApi"
    baseUrl: root.serviceBaseUrl
    appLanguage: root.appLanguage
    onSucceeded: function(tag, payload, status) {
      if (tag !== "local-search:" + root.searchGeneration || !root.textSearch) return
      root.localSearchLoading = false
      var options = root.localSearchOptions.slice()
      var verses = payload.verses || []
      for (var i = 0; i < verses.length; i++) {
        var option = root.searchVerseOption(verses[i], verses[i].version)
        if (option) options.push(option)
      }
      root.localSearchOptions = options
      root.nextLocalSearchPage = payload.next_page_token || ""
      root.updateSearchOptions()
    }
    onFailed: function(tag, message, status, payload) {
      if (tag !== "local-search:" + root.searchGeneration) return
      root.localSearchLoading = false
      root.updateSearchOptions()
    }
  }

  function chooseSearch(option) {
    if (option.more) {
      if (!searchLoading && !localSearchLoading) runSearch(nextSearchPage, true)
      Qt.callLater(openBookPopup)
      return
    }
    if (option.number) {
      bookInput.text = option.number
      refreshSearch()
      Qt.callLater(openBookPopup)
      return
    }
    var parts = option.reference.split(".")
    selectReference({ value: parts[0] }, parts[1], { value: option.version }, parts[2])
  }

  function searchPreviewText(content) {
    return PassageFormat.plainText(content).replace(/\s+/g, " ").trim()
  }

  function requestSearchPreviews(options) {
    searchPreviewApi.cancelQueued("search-preview:")
    if (!textSearch || searchPreviewsLimited) return
    var entries = []
    for (var i = 0; i < options.length && entries.length < 10; i++) {
      var option = options[i]
      if (!option.reference || option.preview || searchPreviews[option.previewKey]
          || failedSearchPreviews[option.previewKey]) continue
      entries.push({ version: Number(option.version), reference: option.reference })
    }
    if (!entries.length) return
    var tag = "search-preview:" + searchGeneration + ":" + JSON.stringify(entries)
    if (searchPreviewApi.activeRequest && searchPreviewApi.activeRequest.tag === tag) return
    searchPreviewApi.get("/v1/search-previews?verses=" + encodeURIComponent(JSON.stringify(entries)), tag)
  }

  LightApi {
    id: searchPreviewApi
    objectName: "searchPreviewApi"
    baseUrl: root.serviceBaseUrl
    appLanguage: root.appLanguage
    onSucceeded: function(tag, payload, status) {
      var prefix = "search-preview:" + root.searchGeneration + ":"
      if (tag.indexOf(prefix) !== 0 || !root.textSearch) return
      var previews = Object.assign({}, root.searchPreviews)
      var received = payload.previews || ({})
      for (var key in received) previews[key] = root.searchPreviewText(received[key])
      root.searchPreviews = previews
      root.failedSearchPreviews = Object.assign({}, root.failedSearchPreviews, payload.failed || ({}))
      if (payload.rateLimited) {
        root.searchPreviewsLimited = true
        cancelQueued("search-preview:")
      }
    }
    onFailed: function(tag, message, status, payload) {
      var prefix = "search-preview:" + root.searchGeneration + ":"
      if (tag.indexOf(prefix) !== 0) return
      var failed = Object.assign({}, root.failedSearchPreviews)
      try {
        var entries = JSON.parse(tag.slice(prefix.length))
        for (var i = 0; i < entries.length; i++)
          failed[entries[i].version + ":" + entries[i].reference] = true
      } catch (error) {}
      root.failedSearchPreviews = failed
      if (status === 429) {
        root.searchPreviewsLimited = true
        cancelQueued("search-preview:")
      }
    }
  }

  Timer { id: searchTimer; objectName: "searchTimer"; interval: 120; onTriggered: root.runSearch("") }
  LightApi {
    id: searchApi
    objectName: "searchApi"
    baseUrl: root.serviceBaseUrl
    appLanguage: root.appLanguage
    onSucceeded: function(tag, payload, status) {
      if (tag !== "search:" + root.searchGeneration || !root.textSearch) return
      root.searchLoading = false
      var options = root.onlineSearchOptions.slice()
      var verses = payload.verses || []
      for (var j = 0; j < verses.length; j++) {
        var hit = verses[j]
        var version = payload.version || root.selectedVersion
        var option = root.searchVerseOption(hit, version)
        if (option) options.push(option)
      }
      root.nextSearchPage = payload.next_page_token || ""
      root.onlineSearchOptions = options
      root.updateSearchOptions()
    }
    onFailed: function(tag, message, status, payload) {
      if (tag !== "search:" + root.searchGeneration) return
      root.searchLoading = false
      root.updateSearchOptions()
      if (!root.searchOptions.length && !root.localSearchLoading) root.searchMessage = message
    }
  }

  function optionValue(option) {
    return option && typeof option === "object" ? String(option.value) : String(option)
  }

  function optionLabel(option) {
    return option && typeof option === "object" ? String(option.label) : String(option)
  }

  function labelFor(options, value) {
    for (var i = 0; i < options.length; i++) {
      if (optionValue(options[i]) === String(value)) return optionLabel(options[i])
    }
    return String(value || "")
  }

  function fieldValue(index) {
    if (index === 0) return labelFor(bookOptions, selectedBook)
      || I18n.t(appLanguage, "book")
    if (index === 1) return selectedChapter || I18n.t(appLanguage, "chapter")
    return labelFor(versionOptions, selectedVersion) || I18n.t(appLanguage, "version")
  }

  function localizedChapterOptions(options) {
    var result = []
    for (var i = 0; i < options.length; i++) {
      var item = options[i]
      result.push({
        value: optionValue(item),
        label: I18n.t(appLanguage, "chapter") + " " + optionValue(item),
        description: optionValue(item)
      })
    }
    return result
  }

  function syncBookText() {
    if (editingQuery) return
    bookInput.text = ""
    bookInput.cursorPosition = 0
  }

  function syncChapterText() {}
  function syncVersionText() { versionQuery = "" }

  function openBrowseMenu() {
    bookPopup.close()
    browseMode = "menu"
    bookInput.forceActiveFocus()
    openBookPopup()
  }

  function browse(mode) {
    if (mode === "chapters" && selectedBook === "") mode = "books"
    bookPopup.close()
    browseMode = mode
    editingQuery = true
    bookInput.text = ""
    refreshSearch()
    bookInput.forceActiveFocus()
    openBookPopup()
  }

  function prepareForImmediateTyping() {
    focusBookForNewInput()
  }

  function focusBookForNewInput() {
    autoReferenceTimer.stop()
    lastAutoReference = ""
    searchTimer.stop()
    searchGeneration += 1
    searchApi.cancelReads("search:")
    localSearchApi.cancelReads("local-search:")
    bookPopup.close()
    editingQuery = true
    browseMode = ""
    bookInput.text = ""
    versionQuery = ""
    refreshSearch()
    bookInput.forceActiveFocus()
    bookInput.cursorPosition = 0
  }

  function restoreReference(book, chapter, version, showReader) {
    browseMode = ""
    editingQuery = false
    selectedVerse = ""
    bookPopup.close()
    selectedBook = String(book || "")
    selectedChapter = String(chapter || "")
    selectedVersion = String(version || selectedVersion)
    syncBookText()
    syncChapterText()
    syncVersionText()
    selectionChanged(selectedBook, selectedChapter, selectedVersion, showReader === true)
  }

  function ensureTypingFocus() {
    // Reassert focus after the Wayland surface prime without disturbing text
    // that may already have arrived from a fast typist.
    bookInput.forceActiveFocus()
  }

  function dismissSuggestions() {
    if (!activeOptionsPopup) return false
    activeOptionsPopup.close()
    return true
  }

  function openBookPopup() {
    if (!bookPopup.opened) bookPopup.open()
  }

  function openChapterPopup() { browse("chapters") }
  function openVersionPopup(resetSearch) { browse("versions") }

  function commitBookInput() {
    if (browseMode !== "") return bookPopup.chooseCurrent()
    if (textSearch) {
      if (searchOptions.length > 0) return bookPopup.chooseCurrent()
      openBookPopup()
      if (searchTimer.running) {
        searchTimer.stop()
        runSearch("")
      }
      return true
    }
    var parsed = bookInputState
    if (!parsed.book || !parsed.compound) return commitBook(true)
    if (!parsed.chapterValid || !parsed.verseValid) {
      openBookPopup()
      return false
    }
    if (parsed.versionQuery !== "" && !parsed.version) {
      openBookPopup()
      return false
    }
    return selectReference(parsed.book, parsed.chapter, parsed.version, parsed.verse)
  }

  function selectReference(book, chapter, version, verse) {
    editingQuery = false
    selectedVerse = verse || ""
    browseMode = ""
    autoReferenceTimer.stop()
    searchTimer.stop()
    searchGeneration += 1
    searchApi.cancelReads("search:")
    localSearchApi.cancelReads("local-search:")
    bookPopup.close()
    selectedBook = optionValue(book)
    selectedChapter = String(chapter)
    if (version) selectedVersion = optionValue(version)
    syncBookText()
    syncChapterText()
    syncVersionText()
    selectionChanged(selectedBook, selectedChapter, selectedVersion, true)
    if (verse) verseRequested(String(verse))
    Qt.callLater(root.readingFocusRequested)
    return true
  }

  function navigateOpenResults(direction) {
    var popup = bookPopup.opened ? bookPopup : null
    if (!popup) return false
    popup.moveSelection(direction)
    return true
  }

  function commitBook(moveToChapter) {
    var match = BibleData.autocompleteOption(bookOptions, bookInput.text)
    if (!match) {
      bookInput.selectAll()
      return false
    }

    return selectBookOption(match, moveToChapter)
  }

  function selectBookOption(match, moveToChapter) {
    editingQuery = false
    selectedVerse = ""
    bookPopup.close()
    var value = optionValue(match)
    var changed = value !== selectedBook
    selectedBook = value
    if (changed) selectedChapter = ""
    bookInput.text = ""
    syncBookText()
    selectionChanged(selectedBook, selectedChapter, selectedVersion, true)

    if (moveToChapter) Qt.callLater(function() { root.browse("chapters") })
    return true
  }

  function matchingChapter(text) {
    var needle = String(text || "").trim()
      .replace(/^(?:chapter|cap[ií]tulo)\s+/i, "")
    if (needle === "") return null
    for (var i = 0; i < chapterOptions.length; i++) {
      if (optionValue(chapterOptions[i]) === needle) return chapterOptions[i]
    }
    return null
  }

  function focusVersion() {
    browse("versions")
  }

  function commitChapter(moveToVersion) {
    if (selectedBook === "") {
      bookInput.forceActiveFocus()
      return false
    }
    var match = matchingChapter(bookInput.text)
    if (!match) {
      bookInput.selectAll()
      return false
    }

    return selectChapterOption(match, moveToVersion)
  }

  function selectChapterOption(match, moveToVersion) {
    editingQuery = false
    selectedVerse = ""
    selectedChapter = optionValue(match)
    syncBookText()
    browseMode = ""
    bookInput.text = ""
    bookPopup.close()
    selectionChanged(selectedBook, selectedChapter, selectedVersion, true)

    if (moveToVersion) Qt.callLater(focusVersion)
    else Qt.callLater(root.readingFocusRequested)
    return true
  }

  function commitVersion() {
    var match = BibleData.autocompleteOption(versionOptions, bookInput.text)
    if (!match) {
      bookInput.selectAll()
      return false
    }
    return selectVersionOption(match)
  }

  function selectVersionOption(match) {
    browseMode = ""
    bookInput.text = ""
    bookPopup.close()
    editingQuery = false
    var value = optionValue(match)
    var changed = value !== selectedVersion
    selectedVersion = value
    syncVersionText()
    syncBookText()
    if (changed) {
      selectionChanged(selectedBook, selectedChapter, selectedVersion, true)
      Qt.callLater(function() {
        bookInput.forceActiveFocus()
        bookInput.selectAll()
      })
    } else {
      Qt.callLater(root.readingFocusRequested)
    }
    return true
  }

  onSelectedBookChanged: if (!applyingLiveReference) syncBookText()
  onSelectedChapterChanged: if (!applyingLiveReference) { syncChapterText(); syncBookText() }
  onBookOptionsChanged: {
    // Do not erase keystrokes if the online catalog arrives while the user types.
    if (!bookInput.activeFocus || bookInput.text === "") syncBookText()
  }
  onVersionOptionsChanged: {
    if (!pickerMode) syncVersionText()
  }
  onSelectedVersionChanged: if (!applyingLiveReference) { syncVersionText(); syncBookText(); refreshSearch() }
  Component.onCompleted: {
    syncBookText()
    syncChapterText()
    syncVersionText()
  }

  Shortcut {
    sequences: ShortcutUtils.expandedSequences(root.keybindings.freshInput || "Ctrl+Backspace")
    context: Qt.WindowShortcut
    // Preserve native word deletion while editing any reference field.
    enabled: root.inputActive && !bookInput.activeFocus
    autoRepeat: false
    onActivated: root.focusBookForNewInput()
  }

  Item {
    id: commandBar
    anchors.horizontalCenter: parent.horizontalCenter
    objectName: "searchCommandBar"
    width: Math.min(parent.width, Style.space(440))
    height: root.controlHeight

    Rectangle {
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      height: Math.min(parent.height, Math.max(Style.space(28), root.textPixelSize + Style.space(6)))
      radius: height / 2
      color: LightPalette.popupBackground
      border.width: Math.max(1, Style.normalBorderWidth)
      border.color: root.inputActive ? root.accent : LightPalette.popupBorder
      Behavior on border.color { ColorAnimation { duration: 140 } }
      MouseArea {
        anchors.fill: parent
        cursorShape: Qt.IBeamCursor
        onClicked: root.openBrowseMenu()
      }
    }

    Row {
      id: commandRow
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.top: parent.top
      anchors.bottom: parent.bottom
      anchors.leftMargin: Style.space(12)
      anchors.rightMargin: Style.space(12)
      spacing: 0

      Item {
        id: bookField
        width: Math.max(
          0,
          commandRow.width - clearSearchButton.width
            - (root.actionContainer ? 0 : actionRow.width)
        )
        height: parent.height

        Row {
          id: referenceHints
          z: 1
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.leftMargin: Style.spacing.controlPaddingX
          anchors.rightMargin: Style.spacing.controlPaddingX
          anchors.verticalCenter: parent.verticalCenter
          height: parent.height
          visible: bookInput.text === ""
          spacing: Style.space(8)
          Text {
            id: bookHint
            objectName: "bookHint"
            width: (referenceHints.width - referenceHints.spacing * 2) / 3
            height: parent.height
            text: root.fieldValue(0)
            color: Util.alpha(root.foreground, 0.42)
            font.family: Style.font.family
            font.pixelSize: Math.max(Style.font.bodySmall, Math.round(root.textPixelSize * 0.8))
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            Accessible.role: Accessible.Button
            Accessible.name: text
            MouseArea {
              anchors.fill: parent
              cursorShape: Qt.PointingHandCursor
              onClicked: root.browse("books")
            }
          }
          Text {
            id: chapterHint
            objectName: "chapterHint"
            width: (referenceHints.width - referenceHints.spacing * 2) / 3
            height: parent.height
            text: root.fieldValue(1)
            color: Util.alpha(root.foreground, 0.42)
            font.family: Style.font.family
            font.pixelSize: Math.max(Style.font.bodySmall, Math.round(root.textPixelSize * 0.8))
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            Accessible.role: Accessible.Button
            Accessible.name: text
            MouseArea {
              anchors.fill: parent
              cursorShape: Qt.PointingHandCursor
              onClicked: root.browse("chapters")
            }
          }
          Text {
            id: versionHint
            objectName: "versionHint"
            width: (referenceHints.width - referenceHints.spacing * 2) / 3
            height: parent.height
            text: root.fieldValue(2)
            color: Util.alpha(root.foreground, 0.42)
            font.family: Style.font.family
            font.pixelSize: Math.max(Style.font.bodySmall, Math.round(root.textPixelSize * 0.8))
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            Accessible.role: Accessible.Button
            Accessible.name: text
            MouseArea {
              anchors.fill: parent
              cursorShape: Qt.PointingHandCursor
              onClicked: root.browse("versions")
            }
          }
        }

        TextMetrics {
          id: bookPrefixMetrics
          text: bookInput.text
          font: bookInput.font
        }

        Text {
          x: bookInput.x + bookPrefixMetrics.width
          width: Math.max(0, bookField.width - x - Style.spacing.controlPaddingX)
          elide: Text.ElideRight
          anchors.verticalCenter: parent.verticalCenter
          visible: !root.pickerMode && bookInput.activeFocus && bookInput.text !== "" && root.bookGhostSuffix !== ""
          text: root.bookGhostSuffix
          color: Qt.darker(root.foreground, 1.8)
          font: bookInput.font
        }

        TextInput {
          id: bookInput
          maximumLength: 100
          anchors.fill: parent
          anchors.leftMargin: Style.spacing.controlPaddingX
          anchors.rightMargin: Style.spacing.controlPaddingX
          color: root.foreground
          selectionColor: Style.selectionFillFor(root.foreground, root.accent, LightPalette.urgent)
          selectedTextColor: root.foreground
          font.family: Style.font.family
          font.pixelSize: Math.max(Style.font.bodySmall, Math.round(root.textPixelSize * 0.8))
          verticalAlignment: TextInput.AlignVCenter
          selectByMouse: true
          clip: true
          activeFocusOnTab: true

          Accessible.role: Accessible.EditableText
          Accessible.name: I18n.t(root.appLanguage, "bibleBook")
          Accessible.description: I18n.t(root.appLanguage, "bibleBookHelp")

          KeyNavigation.tab: clearSearchButton.enabled ? clearSearchButton : settingsButton
          TapHandler {
            onTapped: root.openBrowseMenu()
          }
          onTextEdited: {
            root.editingQuery = true
            root.browseMode = ""
            root.refreshSearch()
            root.openBookPopup()
            autoReferenceTimer.stop()
            if (root.autoOpenReferences && !root.pickerMode) autoReferenceTimer.restart()
          }

          Keys.priority: Keys.BeforeItem
          Keys.onPressed: function(event) {
            if (event.key === Qt.Key_Tab && !(event.modifiers & Qt.ShiftModifier)) {
              root.dismissSuggestions()
              // Let KeyNavigation move focus without opening a result.
              event.accepted = false
            } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
              event.accepted = bookPopup.opened && bookPopup.keyboardSelectionMoved
                ? bookPopup.chooseCurrent()
                : root.commitBookInput()
            } else if (event.key === Qt.Key_Up || event.key === Qt.Key_Down) {
              if (bookPopup.opened) {
                event.accepted = bookPopup.moveSelection(event.key === Qt.Key_Up ? -1 : 1)
              } else {
                root.openBookPopup()
                event.accepted = true
              }
            } else if (event.key === Qt.Key_Escape) {
              if (!root.dismissSuggestions()) root.closeRequested()
              event.accepted = true
            }
          }
        }

        InlineOptionPopup {
          id: bookPopup
          objectName: "bookPopup"
          focusOnOpen: false
          parent: commandBar
          x: 0
          y: commandBar.height + Style.spacing.xxs
          width: commandBar.width
          options: root.browseMode === "menu" ? [
              { value: "books", label: I18n.t(root.appLanguage, "book") + " · " + root.fieldValue(0), picker: true },
              { value: "chapters", label: I18n.t(root.appLanguage, "chapter") + " · " + root.fieldValue(1), picker: true },
              { value: "versions", label: I18n.t(root.appLanguage, "version") + " · " + root.fieldValue(2), picker: true }
            ] : root.browseMode === "chapters" ? root.chapterOptions
            : root.browseMode === "versions" ? root.versionOptions
            : root.browseMode === "books" ? root.bookOptions
            : root.textSearch ? root.searchOptions
            : root.compoundVersionSuggestions ? root.compoundVersions : root.matchingBooks
          previewTexts: root.searchPreviews
          onVisibleOptionsChanged: function(options) { root.requestSearchPreviews(options) }
          value: root.browseMode === "chapters" ? root.selectedChapter
            : root.browseMode === "versions" ? root.selectedVersion : root.selectedBook
          emptyText: root.browseMode === "chapters" ? I18n.t(root.appLanguage, "noChapters")
            : root.browseMode === "versions" ? I18n.t(root.appLanguage, "noVersions")
            : root.textSearch ? root.searchMessage : root.compoundVersionSuggestions
            ? I18n.t(root.appLanguage, "noVersions")
            : I18n.t(root.appLanguage, "noBooks")
          foreground: root.foreground
          accent: root.accent
          rowHeight: root.textSearch
            ? Math.max(Style.space(76), root.textPixelSize * 3.8 + Style.spacing.controlPaddingY * 2)
            : root.optionRowHeight
          maxRows: root.textSearch ? 5 : 8
          fontPixelSize: root.textSearch
            ? Math.max(Style.font.bodySmall, Math.round(root.textPixelSize * 0.9))
            : root.textPixelSize
          onSelected: function(option) {
            if (option.picker) Qt.callLater(function() { root.browse(option.value) })
            else if (root.browseMode === "chapters") root.selectChapterOption(option, false)
            else if (root.browseMode === "versions") root.selectVersionOption(option)
            else if (root.browseMode === "books") root.selectBookOption(option, true)
            else if (root.textSearch) root.chooseSearch(option)
            else if (root.compoundVersionSuggestions)
              root.selectReference(root.bookInputState.book, root.bookInputState.chapter, option, root.bookInputState.verse)
            else root.selectBookOption(option, true)
          }
        }
      }

      Item {
        id: clearSearchButton
        objectName: "clearSearchButton"
        // Reserve this space even when empty so the field never shifts.
        width: Style.space(28)
        height: parent.height
        opacity: bookInput.text !== "" ? 1 : 0
        enabled: bookInput.text !== ""
        activeFocusOnTab: enabled
        KeyNavigation.tab: settingsButton
        KeyNavigation.backtab: bookInput
        Accessible.role: Accessible.Button
        Accessible.name: I18n.t(root.appLanguage, "clearSearch")
        Keys.onReturnPressed: root.focusBookForNewInput()
        Keys.onEnterPressed: root.focusBookForNewInput()
        Keys.onSpacePressed: root.focusBookForNewInput()
        PixelIcon {
          anchors.centerIn: parent
          width: Style.space(12)
          height: width
          name: "close"
          color: clearSearchButton.activeFocus || clearSearchMouse.containsMouse
            ? root.accent : root.muted
        }
        MouseArea {
          id: clearSearchMouse
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onClicked: root.focusBookForNewInput()
        }
      }

      Row {
        id: actionRow
        parent: root.actionContainer || commandRow
        width: implicitWidth
        height: root.actionContainer ? root.actionContainer.height : commandRow.height
        spacing: 0

        Item {
          id: radioButton
          objectName: "radioButton"
          width: root.musicPlayerEnabled ? root.selectorIconButtonWidth : 0
          height: parent.height
          visible: root.musicPlayerEnabled
          enabled: root.musicPlayerEnabled
          activeFocusOnTab: true

          PixelIcon {
            id: pixelMusicIcon
            objectName: "pixelMusicIcon"
            anchors.centerIn: parent
            width: root.selectorIconSize
            height: root.selectorIconSize
            name: "music"
            color: radioButton.activeFocus
              || radioMouseArea.containsMouse
                ? root.accent
                : LightPalette.nightMode ? LightPalette.popupText : Commons.Color.bar.text
          }

          Accessible.name: I18n.t(root.appLanguage, "openRadio")
          Accessible.role: Accessible.Button

          Keys.onReturnPressed: root.radioRequested()
          Keys.onEnterPressed: root.radioRequested()
          Keys.onSpacePressed: root.radioRequested()
          Keys.onEscapePressed: root.closeRequested()

          MouseArea {
            id: radioMouseArea
            anchors.fill: parent
            cursorShape: Qt.PointingHandCursor
            onClicked: root.radioRequested()
          }
        }

        Item {
          id: settingsButton
          objectName: "settingsButton"
          width: root.selectorIconButtonWidth
          height: parent.height
          activeFocusOnTab: true

          PixelIcon {
            id: pixelSettingsIcon
            objectName: "pixelSettingsIcon"
            anchors.centerIn: parent
            width: root.selectorIconSize
            height: root.selectorIconSize
            name: "settings"
            color: settingsButton.activeFocus || settingsMouseArea.containsMouse
              ? root.accent
              : LightPalette.nightMode ? LightPalette.popupText : Commons.Color.bar.text
          }

          Accessible.name: I18n.t(root.appLanguage, "openSettings")
          Accessible.role: Accessible.Button

          Keys.onReturnPressed: root.settingsRequested()
          Keys.onEnterPressed: root.settingsRequested()
          Keys.onSpacePressed: root.settingsRequested()
          Keys.onEscapePressed: root.closeRequested()

          MouseArea {
            id: settingsMouseArea
            anchors.fill: parent
            cursorShape: Qt.PointingHandCursor
            onClicked: root.settingsRequested()
          }
        }
      }
    }

  }

}
