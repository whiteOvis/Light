pragma ComponentBehavior: Bound
import QtQuick
import qs.Commons
import "components"
import "components/BibleData.js" as BibleData
import "components/I18n.js" as I18n

Item {
  id: root

  property bool compactSearch: true
  property bool autoOpenReferences: false
  readonly property var studyPanel: studyLoader.item
  readonly property bool studyOpened: studyPanel ? studyPanel.opened : false
  property bool studyLoaded: false
  property string pendingStudyPage: ""
  property var pendingStudyReference: null
  property var api: null
  property bool accountAuthenticated: false
  property var keybindings: ({})
  property var versionOptions: []
  property var bookOptions: BibleData.bookOptions()
  property var chapterOptions: []
  property var passage: ({})
  property var passageMetadata: ({})
  property bool passageLoading: false
  property string passageError: ""
  property bool catalogRequested: false
  property bool catalogLoaded: false
  property bool recentPassageRequested: false
  property bool serviceAvailable: false
  property string serviceStatus: I18n.t(appLanguage, "connecting")
  property real appScale: 1.2
  property real readerTextScale: 1
  property string readerFontStyle: "youversion"
  property bool redLetters: false
  property bool musicPlayerEnabled: false
  property string appLanguage: "en-US"
  property string systemLocale: "en-US"
  property var secondaryBibleLanguages: []
  property var savedTabState: ({ tabs: [], activeTabIndex: -1 })
  property bool tabStateLoaded: false
  property var tabs: []
  property int activeTabIndex: -1
  property var bibleLanguageOptions: []
  property var highlights: []
  property string defaultHighlightColor: "fffe00"
  property int defaultHighlightColorRevision: 0
  property real defaultHighlightOpacity: 0.45
  property int defaultHighlightOpacityRevision: 0
  property bool highlightPending: false
  property bool readerExpanded: false
  property string _booksRequestKey: ""
  property string _chaptersRequestKey: ""
  property string pendingSearchVerse: ""
  property string _passageRequestKey: ""
  property string _userDataRequestKey: ""
  property int _catalogGeneration: 0
  property var _catalogLanguages: []
  property var _versionBatches: ({})
  property int _pendingCatalogRequests: 0
  property bool _initialTabsRestored: false
  property real _pendingTabScrollY: -1
  property bool _restoringTabScroll: false

  LightTypography {
    id: typography
    appScale: root.appScale
  }

  readonly property color foreground: LightPalette.popupText
  readonly property color muted: LightPalette.muted
  readonly property color accent: LightPalette.accent
  readonly property real readerTextPixelSize: Math.max(
    Style.font.bodySmall,
    Math.round((Style.font.body + Style.space(4)) * readerTextScale)
  )
  readonly property alias inputItem: bibleSelector.inputItem
  readonly property bool searchSuggestionsOpen: bibleSelector.activeOptionsPopup !== null
  readonly property bool keyboardInputActive: bibleSelector.inputActive || studyOpened
  readonly property alias selectedBook: bibleSelector.selectedBook
  readonly property alias selectedChapter: bibleSelector.selectedChapter
  readonly property alias selectedVersion: bibleSelector.selectedVersion
  readonly property string selectedBookLabel: selectedBook === "" ? "" : bibleSelector.fieldValue(0)
  readonly property var selectedVersionInfo: versionInfo(selectedVersion)
  readonly property string selectedVersionLabel: selectedVersionInfo
    ? String(selectedVersionInfo.label || selectedVersionInfo.value || "")
    : selectedVersion
  readonly property string selectedVersionTitle: selectedVersionInfo
    ? String(selectedVersionInfo.description || selectedVersionLabel)
    : selectedVersionLabel
  readonly property string selectedCopyright: selectedVersionInfo && selectedVersionInfo.copyright
    ? String(selectedVersionInfo.copyright)
    : ""
  readonly property bool canNavigatePrevious: BibleData.adjacentChapter(
    chapterOptions,
    selectedChapter,
    -1
  ) !== null
  readonly property bool canNavigateNext: BibleData.adjacentChapter(
    chapterOptions,
    selectedChapter,
    1
  ) !== null
  readonly property real revealControlHeight: Style.space(18)
  readonly property real tabFontPixelSize: Math.max(
    Style.space(8), Math.round(typography.caption * 0.82)
  )
  readonly property real tabStripHeight: Math.max(readerTabRow.implicitHeight, tabActions.height)
  readonly property int maximumTabs: 7
  readonly property real maximumContentHeight: Style.space(760)
  readonly property real collapsedContentHeight: tabStripHeight + bibleSelector.implicitHeight
    + Style.spacing.xxs + revealControlHeight
  readonly property real expandedContentHeight: bibleSelector.implicitHeight
    + tabStripHeight + Style.spacing.md + passageReader.naturalHeight
  readonly property real preferredContentHeight: studyOpened ? maximumContentHeight : readerExpanded
    ? Math.min(maximumContentHeight, expandedContentHeight)
    : collapsedContentHeight

  signal settingsRequested()
  signal radioRequested()
  signal closeRequested()
  signal readingFocusRequested()
  signal tabsCommitRequested(var state)

  Timer {
    id: tabScrollSaveTimer
    interval: 350
    repeat: false
    onTriggered: root.persistActiveTabScroll()
  }

  implicitHeight: preferredContentHeight

  function scrollBy(delta) {
    passageReader.scrollBy(delta)
  }


  function navigateByArrow(direction) {
    if (bibleSelector.navigateOpenResults(direction)) return
    if (!readerExpanded && direction > 0) revealLastPassage()
    else if (readerExpanded) passageReader.scrollByKeyboard(direction)
  }

  function startNewSearch() {
    bibleSelector.focusBookForNewInput()
  }

  function prepareForImmediateTyping() {
    if (!accountAuthenticated) return
    requestCatalog()
    if (tabs.length > 0 && !_initialTabsRestored) {
      _initialTabsRestored = true
      restoreActiveTab(!compactSearch)
    }
    bibleSelector.prepareForImmediateTyping()
  }

  function collapseReader() {
    readerExpanded = false
    passageReader.clearTextSelection()
  }

  function normalizeTabs(value) {
    var raw = value && value.tabs instanceof Array ? value.tabs : []
    var result = []
    for (var i = 0; i < raw.length && result.length < maximumTabs; i++) {
      var item = raw[i] || {}
      var version = String(item.version || "")
      var passage = String(item.passage || "").toUpperCase()
      var verse = String(item.verse || "")
      if (version !== "" && !/^\d+$/.test(version)) continue
      if (passage !== "" && (!/^\d+$/.test(version) || !/^[A-Z0-9]{3}\.\d+$/.test(passage))) continue
      if (verse !== "" && !/^\d+(?:-\d+)?$/.test(verse)) continue
      var normalized = { version: version, passage: passage }
      if (verse !== "") normalized.verse = verse
      var scrollY = Number(item.scrollY)
      if (isFinite(scrollY) && scrollY >= 0)
        normalized.scrollY = Math.round(scrollY)
      result.push(normalized)
    }
    var selected = Number(value && value.activeTabIndex)
    return {
      tabs: result,
      activeTabIndex: Number.isInteger(selected) && selected >= 0 && selected < result.length
        ? selected
        : (result.length > 0 ? 0 : -1)
    }
  }

  function saveTabs() {
    tabsCommitRequested({ tabs: tabs, activeTabIndex: activeTabIndex })
  }

  function restoreSavedTabs() {
    if (!tabStateLoaded) return
    var state = normalizeTabs(savedTabState)
    tabs = state.tabs
    activeTabIndex = state.activeTabIndex
    _initialTabsRestored = false
    if (catalogLoaded && tabs.length > 0) {
      _initialTabsRestored = true
      restoreActiveTab(!compactSearch)
    }
  }

  onCompactSearchChanged: if (!compactSearch) resumeLastPassage()

  function resumeLastPassage() {
    if (!accountAuthenticated) return
    if (passage && passage.content) revealLastPassage()
    else if (tabs.length > 0) restoreActiveTab(true)
  }

  function tabLabel(tab) {
    var ref = tabReference(tab)
    if (!ref) return I18n.t(appLanguage, "newTab")
    var label = BibleData.bookAbbreviation(ref.book) + ref.chapter
    if (ref.verse !== "") label += ":" + ref.verse
    return label
  }

  function tabTooltip(tab) {
    var ref = tabReference(tab)
    if (!ref) return I18n.t(appLanguage, "newTab")
    var book = ref.book
    for (var i = 0; i < bookOptions.length; i++)
      if (bookOptions[i].value === ref.book) book = bookOptions[i].label
    var version = versionInfo(ref.version)
    return book + " " + ref.chapter + (ref.verse !== "" ? ":" + ref.verse : "")
      + " · " + (version ? version.label : ref.version)
  }

  function studyReference() {
    return {
      version: Number(selectedVersion),
      passage: passageReader.selectedHighlightPassage || currentPassageId(),
      label: passageReader.selectedHighlightLabel || String(passage.reference || currentPassageId()),
      preview: passageReader.selectedText
    }
  }

  function openStudy(page, reference) {
    var targetReference = reference || pendingStudyReference || studyReference()
    pendingStudyPage = page
    pendingStudyReference = targetReference
    studyLoaded = true
    if (studyLoader.item) {
      studyPanel.reference = targetReference
      studyPanel.open(page)
      pendingStudyPage = ""
      pendingStudyReference = null
    }
  }

  function closeStudy() {
    if (studyLoader.item) studyPanel.opened = false
    pendingStudyPage = ""
    pendingStudyReference = null
  }

  function openLibraryPassage(item) {
    closeStudy()
    var parts = String(item.passage).split(".")
    pendingSearchVerse = parts.length > 2 ? parts[2].split("-")[0] : ""
    bibleSelector.restoreReference(parts[0], parts[1], String(item.version), true)
    if (!passageLoading && pendingSearchVerse !== "") {
      passageReader.scrollToVerse(pendingSearchVerse)
      pendingSearchVerse = ""
    }
  }

  function tabReference(tab) {
    if (!tab) return null
    var parts = String(tab.passage || "").split(".")
    if (parts.length !== 2) return null
    return {
      book: parts[0], chapter: parts[1], verse: String(tab.verse || ""),
      version: String(tab.version)
    }
  }

  function restoreActiveTab(showReader) {
    if (!accountAuthenticated) return false
    if (activeTabIndex < 0 || activeTabIndex >= tabs.length) return false
    var reference = tabReference(tabs[activeTabIndex])
    if (!reference) {
      clearPassageForNewInput()
      bibleSelector.restoreReference("", "", String(tabs[activeTabIndex].version || selectedVersion), false)
      bibleSelector.focusBookForNewInput()
      return true
    }
    passage = ({})
    passageMetadata = ({})
    highlights = []
    _passageRequestKey = ""
    bibleSelector.restoreReference(
      reference.book,
      reference.chapter,
      reference.version,
      showReader === true
    )
    var savedScrollY = Number(tabs[activeTabIndex].scrollY)
    _pendingTabScrollY = isFinite(savedScrollY) && savedScrollY >= 0
      ? Math.round(savedScrollY)
      : -1
    _restoringTabScroll = _pendingTabScrollY >= 0
    pendingSearchVerse = reference.verse
    return true
  }

  function persistActiveTabScroll() {
    if (_restoringTabScroll || activeTabIndex < 0 || activeTabIndex >= tabs.length
        || !tabReference(tabs[activeTabIndex])) return
    var scrollY = Number(passageReader.scrollY)
    if (!isFinite(scrollY) || scrollY < 0) return
    var next = tabs.slice(0)
    var current = next[activeTabIndex]
    next[activeTabIndex] = {
      version: current.version,
      passage: current.passage,
      verse: current.verse,
      scrollY: Math.round(scrollY)
    }
    if (next[activeTabIndex].verse === "") delete next[activeTabIndex].verse
    tabs = next
    saveTabs()
  }

  function rememberFetchedTab() {
    if (!passage || !passage.content || selectedVersion === "") return
    var reference = currentPassageId()
    if (!/^[A-Z0-9]{3}\.\d+$/.test(reference)) return
    var next = tabs.slice(0)
    var existing = activeTabIndex >= 0 && activeTabIndex < next.length
      ? next[activeTabIndex]
      : null
    var item = { version: String(selectedVersion), passage: reference }
    if (pendingSearchVerse !== "") item.verse = pendingSearchVerse
    if (existing && String(existing.version) === item.version && existing.passage === reference
        && existing.scrollY !== undefined) {
      item.scrollY = existing.scrollY
    }
    if (activeTabIndex < 0 || activeTabIndex >= next.length) {
      if (next.length >= maximumTabs) {
        return
      }
      next.push(item)
      activeTabIndex = next.length - 1
    } else {
      next[activeTabIndex] = item
    }
    tabs = next
    saveTabs()
    if (api) api.post("/v1/study/history", {
      version: Number(selectedVersion), passage: reference,
      label: String(passage.reference || reference)
    }, "view.history-save")
  }

  function clearPassageForNewInput() {
    if (api) api.cancelReads("view.passage:")
    _passageRequestKey = ""
    passageLoading = false
    passageError = ""
    passage = ({})
    passageMetadata = ({})
    highlights = []
    pendingSearchVerse = ""
    _pendingTabScrollY = -1
    _restoringTabScroll = false
    collapseReader()
  }

  function openNewTab() {
    if (tabs.length >= maximumTabs) return false
    tabScrollSaveTimer.stop()
    persistActiveTabScroll()
    tabs = tabs.concat([{ version: String(selectedVersion), passage: "" }])
    activeTabIndex = tabs.length - 1
    clearPassageForNewInput()
    bibleSelector.restoreReference("", "", selectedVersion, false)
    saveTabs()
    bibleSelector.focusBookForNewInput()
    return true
  }

  function selectTab(index) {
    if (index < 0 || index >= tabs.length) return false
    tabScrollSaveTimer.stop()
    persistActiveTabScroll()
    activeTabIndex = index
    saveTabs()
    restoreActiveTab(true)
    return true
  }

  function cycleTabs(direction) {
    if (tabs.length < 2) return false
    var step = direction < 0 ? -1 : 1
    var start = activeTabIndex >= 0 ? activeTabIndex : 0
    return selectTab((start + step + tabs.length) % tabs.length)
  }

  function closeActiveTab() {
    if (tabs.length === 0) return false
    tabScrollSaveTimer.stop()
    persistActiveTabScroll()
    var index = activeTabIndex >= 0 ? activeTabIndex : 0
    var next = tabs.slice(0)
    next.splice(index, 1)
    tabs = next
    if (next.length === 0) {
      activeTabIndex = -1
      clearPassageForNewInput()
      bibleSelector.restoreReference("", "", selectedVersion, false)
      saveTabs()
      bibleSelector.focusBookForNewInput()
      return true
    }
    activeTabIndex = Math.min(index, next.length - 1)
    saveTabs()
    restoreActiveTab(true)
    return true
  }

  function revealLastPassage() {
    if (!passage || !passage.content) return
    readerExpanded = true
    Qt.callLater(function() { root.readingFocusRequested() })
  }

  function ensureTypingFocus() {
    bibleSelector.ensureTypingFocus()
  }

  function navigateChapter(direction) {
    var chapter = BibleData.adjacentChapter(
      chapterOptions,
      selectedChapter,
      direction
    )
    if (!chapter) return false
    bibleSelector.selectChapterOption(chapter, false)
    return true
  }

  function collectionItems(payload) {
    if (!payload) return []
    var data = payload.data !== undefined ? payload.data : payload
    if (data instanceof Array) return data
    if (data && data.data instanceof Array) return data.data
    return []
  }

  function versionInfo(value) {
    for (var i = 0; i < versionOptions.length; i++) {
      if (String(versionOptions[i].value) === String(value)) return versionOptions[i]
    }
    return null
  }

  function requestCatalog() {
    if (!api || !accountAuthenticated || catalogRequested) return
    catalogRequested = true
    api.get("/health", "view.health")
    api.get(
      "/v1/languages?locale=" + encodeURIComponent(appLanguage) + "&mode=auto",
      "view.languages"
    )
    _catalogGeneration += 1
    _catalogLanguages = selectedCatalogLanguages()
    _versionBatches = ({})
    _pendingCatalogRequests = _catalogLanguages.length
    for (var i = 0; i < _catalogLanguages.length; i++) {
      var language = String(_catalogLanguages[i])
      api.get(
        "/v1/versions?language=" + encodeURIComponent(language) + "&mode=auto",
        "view.versions:" + String(_catalogGeneration) + ":" + language
      )
    }
    if (!recentPassageRequested) {
      recentPassageRequested = true
      api.get("/v1/recent-passage", "view.recent-passage")
    }
  }

  function selectedCatalogLanguages() {
    var primary = I18n.bibleLanguage(systemLocale)
    var result = [primary]
    var seen = ({})
    seen[primary] = true
    var secondary = secondaryBibleLanguages instanceof Array
      ? secondaryBibleLanguages
      : []
    for (var i = 0; i < secondary.length; i++) {
      var language = String(secondary[i] || "")
      if (!language || seen[language]) continue
      seen[language] = true
      result.push(language)
    }
    return result
  }

  function reloadCatalog() {
    if (!catalogRequested) return
    catalogRequested = false
    requestCatalog()
  }

  function rebuildVersionOptions() {
    var merged = []
    var seen = ({})
    for (var builtInIndex = 0; builtInIndex < merged.length; builtInIndex++)
      seen[String(merged[builtInIndex].value)] = true
    for (var languageIndex = 0; languageIndex < _catalogLanguages.length; languageIndex++) {
      var language = String(_catalogLanguages[languageIndex])
      var batch = _versionBatches[language]
      if (!(batch instanceof Array)) continue
      var versions = adaptVersions(batch)
      for (var versionIndex = 0; versionIndex < versions.length; versionIndex++) {
        var version = versions[versionIndex]
        var id = String(version.value)
        if (seen[id]) continue
        seen[id] = true
        merged.push(version)
      }
    }
    versionOptions = merged
  }

  function finishCatalogRequest() {
    _pendingCatalogRequests = Math.max(0, _pendingCatalogRequests - 1)
    if (_pendingCatalogRequests > 0) return
    catalogLoaded = true
    var selectedExists = versionInfo(bibleSelector.selectedVersion) !== null
    if (!selectedExists)
      bibleSelector.selectedVersion = versionOptions.length > 0
        ? String(versionOptions[0].value) : ""
    _lastVersion = bibleSelector.selectedVersion
    if (tabs.length > 0 && !_initialTabsRestored) {
      _initialTabsRestored = true
      restoreActiveTab(!compactSearch)
    } else {
      if (bibleSelector.selectedVersion !== "") loadBooks(bibleSelector.selectedVersion)
    }
  }

  function adaptLanguages(items) {
    var result = []
    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {}
      if (!item.id) continue
      var names = item.display_names || ({})
      var label = names[appLanguage]
        || names[String(appLanguage).split("-")[0]]
        || names.en
        || item.localized_name
        || item.id
      result.push({
        value: String(item.id),
        label: String(label),
        description: String(item.id),
        aliases: item.aliases instanceof Array ? item.aliases : []
      })
    }
    result.sort(function(left, right) {
      return String(left.label).localeCompare(String(right.label))
    })
    return result
  }

  function loadBooks(version) {
    if (!api || String(version || "") === "") return
    var requestKey = String(version)
    if (_booksRequestKey === requestKey) return
    _booksRequestKey = requestKey
    serviceStatus = I18n.t(appLanguage, "loadingBooks")
    api.get(
      "/v1/books?version=" + encodeURIComponent(String(version)) + "&mode=auto",
      "view.books:" + String(version)
    )
  }

  function loadChapters(version, book) {
    if (!api || String(version || "") === "" || String(book || "") === "") return
    var requestKey = String(version) + ":" + String(book)
    if (_chaptersRequestKey === requestKey) return
    _chaptersRequestKey = requestKey
    api.get(
      "/v1/chapters?version=" + encodeURIComponent(String(version))
        + "&book=" + encodeURIComponent(String(book)) + "&mode=auto",
      "view.chapters:" + String(version) + ":" + String(book)
    )
  }

  function loadPassage(showReader) {
    if (!api || selectedVersion === "" || selectedBook === "" || selectedChapter === "") return
    if (showReader === true) readerExpanded = true
    var usfm = selectedBook + "." + selectedChapter
    var requestKey = selectedVersion + ":" + usfm
    if (_passageRequestKey === requestKey) return
    _passageRequestKey = requestKey
    passageLoading = true
    passageError = ""
    api.get(
      "/v1/passage?version=" + encodeURIComponent(selectedVersion)
        + "&usfm=" + encodeURIComponent(usfm)
        + "&format=html&include_headings=true&include_notes=true&mode=auto",
      "view.passage:" + selectedVersion + ":" + usfm
    )
  }

  function currentPassageId() {
    if (passage && passage.id) return String(passage.id).toUpperCase()
    if (selectedBook !== "" && selectedChapter !== "")
      return (selectedBook + "." + selectedChapter).toUpperCase()
    return ""
  }

  function loadUserData(forceSync) {
    if (!api || selectedVersion === "") return
    var passageId = currentPassageId()
    if (passageId === "") return
    var context = encodeURIComponent(selectedVersion) + ":" + encodeURIComponent(passageId)
    if (!forceSync && _userDataRequestKey === context) return
    _userDataRequestKey = context
    api.get(
      "/v1/user-data?version=" + encodeURIComponent(selectedVersion)
        + "&passage=" + encodeURIComponent(passageId),
      "view.user-data:" + context
    )
    // Local data is displayed first. This follow-up merges the account copy
    // and flushes any offline highlight operations when sign-in is available.
    api.post(
      "/v1/user-data/sync",
      { version: Number(selectedVersion), passage: passageId },
      "view.highlight-sync:" + context
    )
  }

  function syncAccountHighlights() {
    if (currentPassageId() !== "") loadUserData(true)
  }

  function setDefaultHighlightColor(color, selectedByUser) {
    var normalized = String(color || "").replace(/^#/, "").toLowerCase()
    if (!/^[0-9a-f]{6}$/.test(normalized)) return
    if (selectedByUser === true) defaultHighlightColorRevision += 1
    defaultHighlightColor = normalized
  }

  function setDefaultHighlightOpacity(opacity, selectedByUser) {
    var normalized = Number(opacity)
    if (!isFinite(normalized) || normalized < 0.2 || normalized > 0.75) return
    if (selectedByUser === true) defaultHighlightOpacityRevision += 1
    defaultHighlightOpacity = Math.round(normalized * 100) / 100
  }

  function upsertHighlight(highlight) {
    if (!highlight || !highlight.passage) return
    var passageId = String(highlight.passage).toUpperCase()
    var next = []
    var replaced = false
    for (var i = 0; i < highlights.length; i++) {
      var item = highlights[i] || {}
      if (String(item.passage || "").toUpperCase() === passageId) {
        next.push(highlight)
        replaced = true
      } else {
        next.push(item)
      }
    }
    if (!replaced) next.push(highlight)
    highlights = next
  }

  function removeHighlight(passageId) {
    var removed = String(passageId || "").toUpperCase()
    var next = []
    for (var i = 0; i < highlights.length; i++) {
      var item = highlights[i] || {}
      if (String(item.passage || "").toUpperCase() !== removed) next.push(item)
    }
    highlights = next
  }

  function createHighlight(passageId, selectionRanges) {
    if (!api || selectedVersion === "" || String(passageId || "") === "") return
    highlightPending = true
    api.post(
      "/v1/user-data/highlights",
      {
        version: Number(selectedVersion),
        passage: String(passageId),
        color: defaultHighlightColor,
        selectionRanges: selectionRanges || []
      },
      "view.highlight-create:" + String(passageId)
    )
  }

  function deleteHighlight(passageId) {
    if (!api || selectedVersion === "" || String(passageId || "") === "") return
    highlightPending = true
    api.remove(
      "/v1/user-data/highlights?version=" + encodeURIComponent(selectedVersion)
        + "&passage=" + encodeURIComponent(String(passageId)),
      "view.highlight-delete:" + String(passageId)
    )
  }

  function adaptVersions(items) {
    var result = []
    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {}
      if (item.id === undefined || item.id === null) continue
      result.push({
        value: String(item.id),
        label: String(item.localized_abbreviation || item.abbreviation || item.id),
        description: String(item.localized_title || item.title
          || I18n.t(appLanguage, "bibleTranslation")),
        aliases: [item.abbreviation || "", item.title || "", item.language_tag || ""],
        copyright: item.copyright || "",
        languageTag: item.language_tag || "",
        deepLink: item.youversion_deep_link || ""
      })
    }
    return result
  }

  function adaptBooks(items) {
    var result = []
    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {}
      if (!item.id) continue
      result.push({
        value: String(item.id),
        label: String(item.title || item.full_title || item.id),
        description: String(item.full_title || item.abbreviation || item.id),
        aliases: [item.abbreviation || "", item.full_title || "", item.id || ""],
        chapters: item.chapters instanceof Array ? item.chapters.length : 0
      })
    }
    return result
  }

  function adaptChapters(items) {
    var result = []
    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {}
      if (item.id === undefined || item.id === null) continue
      result.push({
        value: String(item.id),
        label: String(item.title
          || (I18n.t(appLanguage, "chapter") + " " + item.id)),
        description: String(item.id),
        passageId: item.passage_id || ""
      })
    }
    return result
  }

  function handleSelection(book, chapter, version, showReader) {
    pendingSearchVerse = ""
    var previousVersion = root._lastVersion
    var previousBook = root._lastBook
    root._lastVersion = version
    root._lastBook = book
    var revealReader = showReader !== false

    if (version !== previousVersion) {
      chapterOptions = []
      passage = ({})
      highlights = []
      loadBooks(version)
      if (book !== "") loadChapters(version, book)
      if (chapter !== "") loadPassage(revealReader)
      return
    }
    if (book !== previousBook) {
      chapterOptions = []
      passage = ({})
      highlights = []
      loadChapters(version, book)
      if (chapter !== "") loadPassage(revealReader)
      return
    }
    if (chapter !== "") loadPassage(revealReader)
  }

  property string _lastVersion: ""
  property string _lastBook: ""

  Connections {
    target: root.api

    function onSucceeded(tag, payload, status) {
      if (!root.accountAuthenticated) return
      if (tag === "view.health") {
        root.serviceAvailable = payload && payload.ok === true
        root.serviceStatus = root.serviceAvailable
          ? (payload.onlineConfigured
            ? I18n.t(root.appLanguage, "serviceReadyBoth")
            : I18n.t(root.appLanguage, "serviceReadyOffline"))
          : I18n.t(root.appLanguage, "serviceUnavailable")
        return
      }

      if (tag === "view.languages") {
        root.bibleLanguageOptions = root.adaptLanguages(root.collectionItems(payload))
        return
      }

      if (String(tag).indexOf("view.versions:") === 0) {
        var versionTag = String(tag).split(":")
        if (Number(versionTag[1]) !== root._catalogGeneration) return
        var language = versionTag.slice(2).join(":")
        var batches = ({})
        for (var existingLanguage in root._versionBatches)
          batches[existingLanguage] = root._versionBatches[existingLanguage]
        batches[language] = root.collectionItems(payload)
        root._versionBatches = batches
        root.rebuildVersionOptions()
        root.finishCatalogRequest()
        return
      }

      if (tag === "view.recent-passage") {
        if (root.tabStateLoaded && root.tabs.length > 0) return
        var selection = payload && payload.selection ? payload.selection : ({})
        var reference = String(selection.usfm || "").toUpperCase()
        var referenceParts = reference.split(".")
        if (referenceParts.length >= 2 && selection.version) {
          bibleSelector.selectedVersion = String(selection.version)
          bibleSelector.selectedBook = referenceParts[0]
          bibleSelector.selectedChapter = referenceParts[1]
          root._lastVersion = bibleSelector.selectedVersion
          root._lastBook = bibleSelector.selectedBook
          root.pendingSearchVerse = referenceParts.length > 2
            ? referenceParts[2].split("-")[0] : ""
          root.passage = payload.data || ({})
          root.passageMetadata = payload.meta || ({})
          root.loadBooks(bibleSelector.selectedVersion)
          root.loadChapters(bibleSelector.selectedVersion, bibleSelector.selectedBook)
          root.loadUserData()
          root.rememberFetchedTab()
        }
        return
      }

      if (String(tag).indexOf("view.books:") === 0) {
        var requestedVersion = String(tag).split(":")[1]
        if (requestedVersion !== bibleSelector.selectedVersion) return
        var books = root.adaptBooks(root.collectionItems(payload))
        if (books.length > 0) root.bookOptions = books
        root.serviceStatus = payload && payload.meta && payload.meta.source
          ? I18n.t(root.appLanguage, "contentSource", {
            source: String(payload.meta.source).replace(/-/g, " ")
          })
          : I18n.t(root.appLanguage, "booksReady")
        return
      }

      if (String(tag).indexOf("view.chapters:") === 0) {
        var chapterTag = String(tag).split(":")
        if (chapterTag[1] !== bibleSelector.selectedVersion || chapterTag[2] !== bibleSelector.selectedBook) return
        root.chapterOptions = root.adaptChapters(root.collectionItems(payload))
        return
      }

      if (String(tag).indexOf("view.passage:") === 0) {
        var expectedTag = "view.passage:" + bibleSelector.selectedVersion + ":"
          + bibleSelector.selectedBook + "." + bibleSelector.selectedChapter
        if (String(tag) !== expectedTag) return
        root.passage = payload && payload.data ? payload.data : ({})
        root.passageMetadata = payload && payload.meta ? payload.meta : ({})
        root.passageLoading = false
        root.passageError = ""
        if (root.pendingSearchVerse !== "") Qt.callLater(function() {
          passageReader.scrollToVerse(root.pendingSearchVerse)
          root.pendingSearchVerse = ""
        })
        if (root._pendingTabScrollY >= 0)
          passageReader.restoreScrollY(root._pendingTabScrollY)
        root.loadUserData()
        root.rememberFetchedTab()
        return
      }

      if (String(tag).indexOf("view.user-data:") === 0) {
        var expectedUserDataTag = "view.user-data:" + encodeURIComponent(root.selectedVersion)
          + ":" + encodeURIComponent(root.currentPassageId())
        if (String(tag) !== expectedUserDataTag) return
        root.highlights = payload && payload.highlights instanceof Array
          ? payload.highlights
          : []
        if (payload && payload.preferences) {
          if (root.defaultHighlightColorRevision === 0)
            root.setDefaultHighlightColor(payload.preferences.defaultHighlightColor)
          if (root.defaultHighlightOpacityRevision === 0)
            root.setDefaultHighlightOpacity(payload.preferences.defaultHighlightOpacity)
        }
        return
      }

      if (String(tag).indexOf("view.highlight-sync:") === 0) {
        var expectedSyncTag = "view.highlight-sync:" + encodeURIComponent(root.selectedVersion)
          + ":" + encodeURIComponent(root.currentPassageId())
        if (String(tag) !== expectedSyncTag) return
        if (payload && payload.highlights instanceof Array)
          root.highlights = payload.highlights
        return
      }

      if (String(tag).indexOf("view.highlight-create:") === 0) {
        root.highlightPending = false
        var createdPassage = String(tag).slice("view.highlight-create:".length).toUpperCase()
        if (createdPassage.indexOf(root.currentPassageId() + ".") === 0
            && payload && payload.highlight)
          root.upsertHighlight(payload.highlight)
        passageReader.clearTextSelection()
        passageReader.showCopied(payload && payload.queued
          ? I18n.t(root.appLanguage, "highlightSavedQueued")
          : I18n.t(root.appLanguage, "highlightSavedSynced"))
        return
      }
      if (String(tag).indexOf("view.highlight-delete:") === 0) {
        root.highlightPending = false
        var deletedPassage = payload && payload.passage
          ? String(payload.passage).toUpperCase()
          : String(tag).slice("view.highlight-delete:".length).toUpperCase()
        root.removeHighlight(deletedPassage)
        passageReader.clearTextSelection()
        passageReader.showCopied(payload && payload.queued
          ? I18n.t(root.appLanguage, "highlightDeletedQueued")
          : I18n.t(root.appLanguage, "highlightDeletedSynced"))
        return
      }
    }

    function onFailed(tag, message, status, payload) {
      if (!root.accountAuthenticated) return
      if (String(tag).indexOf("view.") !== 0) return
      if (String(tag).indexOf("view.highlight-sync:") === 0) {
        // Account sync is additive; an offline or signed-out reader keeps the
        // local copy returned by view.user-data.
        return
      }
      if (String(tag).indexOf("view.user-data:") === 0) return
      if (String(tag).indexOf("view.highlight-create:") === 0) {
        root.highlightPending = false
        passageReader.showCopied(I18n.t(root.appLanguage, "highlightSaveFailed", {
          message: message
        }))
        return
      }
      if (String(tag).indexOf("view.highlight-delete:") === 0) {
        root.highlightPending = false
        passageReader.showCopied(I18n.t(root.appLanguage, "highlightDeleteFailed", {
          message: message
        }))
        return
      }
      if (String(tag).indexOf("view.passage:") === 0) {
        root.passageLoading = false
        root._passageRequestKey = ""
        root.passageError = message
      } else if (String(tag).indexOf("view.versions:") === 0) {
        var failedVersionTag = String(tag).split(":")
        if (Number(failedVersionTag[1]) !== root._catalogGeneration) return
        root.serviceStatus = message
        root.finishCatalogRequest()
      } else if (tag === "view.languages") {
        // Version loading remains usable when the optional language directory
        // cannot be refreshed.
      } else if (tag === "view.health") {
        root.catalogRequested = false
        root.serviceAvailable = false
        root.serviceStatus = message
      } else if (tag === "view.recent-passage") {
        // A first launch legitimately has no recent passage to restore.
      } else {
        if (String(tag).indexOf("view.books:") === 0)
          root._booksRequestKey = ""
        if (String(tag).indexOf("view.chapters:") === 0)
          root._chaptersRequestKey = ""
        root.serviceStatus = message
      }
    }
  }

  onSystemLocaleChanged: reloadCatalog()
  onSecondaryBibleLanguagesChanged: reloadCatalog()
  onTabStateLoadedChanged: restoreSavedTabs()
  onAccountAuthenticatedChanged: {
    if (accountAuthenticated) {
      requestCatalog()
    } else {
      _catalogGeneration += 1
      catalogRequested = false
      catalogLoaded = false
      recentPassageRequested = false
      versionOptions = []
      bibleSelector.selectedVersion = ""
      bibleSelector.selectedBook = ""
      bibleSelector.selectedChapter = ""
      _lastVersion = ""
      _lastBook = ""
      passage = ({})
      passageMetadata = ({})
      highlights = []
      readerExpanded = false
      closeStudy()
    }
  }

  Item {
    id: readerTabStrip
    objectName: "readerTabStrip"
    anchors.top: parent.top
    anchors.left: parent.left
    anchors.right: parent.right
    height: root.tabStripHeight

    Row {
      id: readerTabRow
      objectName: "readerTabRow"
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.verticalCenter: parent.verticalCenter
      spacing: Style.spacing.xs
      z: 1

      Repeater {
        model: root.tabs

        delegate: ElideButton {
          id: readerTab
          objectName: "reader-tab-" + index
          required property var modelData
          required property int index
          fullText: root.tabLabel(modelData)
          tooltipText: root.tabTooltip(modelData)
          fontSize: root.tabFontPixelSize
          horizontalPadding: Style.spacing.xs
          verticalPadding: Style.spacing.xxs
          minimumHeight: Style.space(22)
          elideMode: Text.ElideNone
          selected: index === root.activeTabIndex
          borderSpec: selected
            ? Border.controlSpec("focus", root.foreground, root.accent)
            : Border.none()
          foreground: index === root.activeTabIndex ? root.accent : root.muted
          focusable: selected
          onClicked: root.selectTab(index)
        }
      }

    }

    Item {
      id: tabActions
      anchors.right: parent.right
      anchors.rightMargin: Style.spacing.xs
      anchors.verticalCenter: parent.verticalCenter
      width: bibleSelector.actionWidth
      height: Math.max(Style.space(22), bibleSelector.actionIconSize + Style.spacing.xxs * 2)
    }
  }

  BibleSelector {
    id: bibleSelector
    keybindings: root.keybindings
    objectName: "bibleSelector"
    z: 20
    anchors.top: readerTabStrip.bottom
    anchors.left: parent.left
    anchors.right: parent.right
    serviceBaseUrl: root.api && root.api.baseUrl ? root.api.baseUrl : "http://127.0.0.1:8788"
    onVerseRequested: function(verse) {
      if (root.passageLoading) root.pendingSearchVerse = verse
      else Qt.callLater(function() { passageReader.scrollToVerse(verse) })
    }
    versionOptions: root.versionOptions
    bookOptions: root.bookOptions
    chapterOptionsOverride: root.chapterOptions
    textPixelSize: root.readerTextPixelSize
    appLanguage: root.appLanguage
    musicPlayerEnabled: root.musicPlayerEnabled
    autoOpenReferences: root.autoOpenReferences
    actionContainer: tabActions
    actionIconSize: root.tabFontPixelSize * 2
    onSelectionChanged: function(book, chapter, version, showReader) {
      root.handleSelection(book, chapter, version, showReader)
    }
    onSettingsRequested: root.settingsRequested()
    onRadioRequested: root.radioRequested()
    onCloseRequested: root.closeRequested()
    onReaderScrollRequested: function(direction) {
      if (!root.readerExpanded && direction > 0) root.revealLastPassage()
      else if (root.readerExpanded) passageReader.scrollByKeyboard(direction)
    }
    onReadingFocusRequested: root.readingFocusRequested()
  }

  Item {
    id: revealLastPassageButton
    anchors.top: bibleSelector.bottom
    anchors.topMargin: Style.spacing.xxs
    anchors.left: parent.left
    anchors.right: parent.right
    height: root.readerExpanded ? 0 : root.revealControlHeight
    visible: !root.readerExpanded

    Accessible.role: Accessible.Button
    Accessible.name: I18n.t(root.appLanguage, "showLastPassage")


    PixelIcon {
      anchors.centerIn: parent
      width: Style.space(14)
      height: Style.space(14)
      name: "down"
      color: revealHover.hovered && revealMouse.enabled ? root.accent : root.muted
      opacity: revealMouse.enabled ? 1 : 0.35
    }

    HoverHandler { id: revealHover }

    MouseArea {
      id: revealMouse
      anchors.fill: parent
      enabled: root.passage && !!root.passage.content
      cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
      onClicked: root.revealLastPassage()
    }
  }

  PassageReader {
    id: passageReader
    keybindings: root.keybindings
    z: 0
    anchors.top: bibleSelector.bottom
    anchors.topMargin: Style.spacing.xxs
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    visible: root.readerExpanded
    api: root.api
    versionId: root.selectedVersion
    passage: root.passage
    metadata: root.passageMetadata
    versionLabel: root.selectedVersionLabel
    versionTitle: root.selectedVersionTitle
    copyrightText: root.selectedCopyright
    textPixelSize: root.readerTextPixelSize
    appScale: root.appScale
    readerFontStyle: root.readerFontStyle
    redLetters: root.redLetters
    appLanguage: root.appLanguage
    canNavigatePrevious: root.canNavigatePrevious
    canNavigateNext: root.canNavigateNext
    loading: root.passageLoading
    errorMessage: root.passageError
    highlights: root.highlights
    highlightPending: root.highlightPending
    defaultHighlightColor: root.defaultHighlightColor
    defaultHighlightOpacity: root.defaultHighlightOpacity
    onRetryRequested: root.loadPassage(true)
    onPreviousRequested: root.navigateChapter(-1)
    onNextRequested: root.navigateChapter(1)
    onHighlightRequested: function(passage, selectionRanges) {
      root.createHighlight(passage, selectionRanges)
    }
    onDeleteHighlightRequested: function(passage) {
      root.deleteHighlight(passage)
    }
    onCompareRequested: function(passage, label, preview) {
      root.openStudy("compare", {
        version: Number(root.selectedVersion),
        passage: passage,
        label: label,
        preview: preview
      })
    }
    onReadingFocusRequested: root.readingFocusRequested()
    onCloseRequested: root.closeRequested()
    onScrollYChanged: {
      if (!root._restoringTabScroll) tabScrollSaveTimer.restart()
    }
    onScrollYRestored: {
      root._restoringTabScroll = false
      root._pendingTabScrollY = -1
    }
  }
  Loader {
    id: studyLoader
    anchors.fill: parent
    z: 100
    active: root.studyLoaded
    asynchronous: true
    onLoaded: if (root.pendingStudyPage !== "")
      root.openStudy(root.pendingStudyPage, root.pendingStudyReference)
    sourceComponent: StudyPanel {
      api: root.api
      appLanguage: root.appLanguage
      appScale: root.appScale
      readerTextPixelSize: root.readerTextPixelSize
      readerFontStyle: root.readerFontStyle
      redLetters: root.redLetters
      defaultHighlightOpacity: root.defaultHighlightOpacity
      highlights: root.highlights
      versions: root.versionOptions
      versionLabel: root.selectedVersionLabel
      onCloseRequested: root.closeStudy()
      onPassageRequested: function(reference) { root.openLibraryPassage(reference) }
    }
  }

}
