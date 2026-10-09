pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls as QQC
import qs.Commons
import qs.Ui
import "I18n.js" as I18n
import "BibleData.js" as BibleData
import "RadioStations.js" as RadioStations
import "RadioSkins.js" as RadioSkins

FocusScope {
  id: root

  property string settingsPage: "reading"
  property bool resumeReading: true
  property bool autoOpenReferences: false
  property var favoriteStations: []
  property string editingStationUrl: ""
  property string pendingEditedStationUrl: ""
  property var pendingEditedStationOrder: []
  property string stationSearch: ""
  readonly property var filteredRadioStations: managedRadioStations.filter(function(station) {
    var query = stationSearch.trim().toLowerCase()
    return !query || (String(station.name) + " " + String(station.description || "") + " " + String(station.streamUrl)).toLowerCase().indexOf(query) >= 0
  })
  signal studyOptionsCommitRequested(var options)
  signal textBrightnessPreviewRequested(real value)
  signal textBrightnessCommitRequested(real value)
  signal backupRestored()
  property bool opened: false
  property var api: null
  property var versionOptions: []
  property string selectedVersion: ""
  property string selectedVersionLabel: ""
  property real appScale: 1.2
  property real readerTextScale: 1
  property string readerFontStyle: "youversion"
  property bool redLetters: false
  property bool verseOfTheDayEnabled: false
  property bool musicPlayerEnabled: false
  property int radioSkin: 1
  property var radioSkinOrder: []
  property var builtInRadioStations: []
  property var customRadioStations: []
  property var hiddenRadioStationIds: []
  property var radioStationOrder: []
  property var settingsSectionOrder: [
    "reading", "appearance", "radio", "languages", "account", "shortcuts", "backup"
  ]
  property var displayedSettingsSectionOrder: normalizedSettingsSectionOrder(settingsSectionOrder)
  property string draggedSettingsSection: ""
  property string appLanguage: "en-US"
  property string systemLocale: "en-US"
  property var bibleLanguageOptions: []
  property var secondaryBibleLanguages: []
  property var keybindings: ({})
  property string capturingKeybinding: ""
  property string pendingKeybinding: ""
  property string captureModifierPreview: ""
  property string shortcutConflictMessage: ""
  property int draggedRadioStationIndex: -1

  property bool authenticated: false
  property bool authConfigured: false
  property bool signInPending: false
  property bool signInStarting: false
  property string authExpiry: ""
  property var accountProfile: ({})
  property var packages: []
  property string versionSearchQuery: ""
  property var versionCatalog: []
  property bool versionCatalogRequested: false
  property bool versionCatalogLoading: false
  readonly property var versionSearchMatches: {
    var query = versionSearchQuery.trim().toLowerCase()
    if (!query || !authenticated) return []
    var matches = versionCatalog.filter(function(item) {
      return Number(item.id) !== 9000001 && (
        String(item.localized_abbreviation || item.abbreviation || "").toLowerCase().indexOf(query) >= 0
        || String(item.localized_title || item.title || "").toLowerCase().indexOf(query) >= 0)
    })
    matches.sort(function(a, b) {
      function rank(item) {
        var abbreviation = String(item.localized_abbreviation || item.abbreviation || "").toLowerCase()
        var title = String(item.localized_title || item.title || "").toLowerCase()
        return abbreviation === query ? 0 : abbreviation.indexOf(query) === 0 ? 1
          : title.indexOf(query) === 0 ? 2 : 3
      }
      return rank(a) - rank(b)
        || String(a.localized_title || a.title || "").localeCompare(String(b.localized_title || b.title || ""))
    })
    return matches
  }
  property string highlightColor: "fffe00"
  property int highlightColorRevision: 0
  property bool highlightColorSaveInFlight: false
  property int activeHighlightColorSaveRevision: 0
  property real highlightOpacity: 0.45
  property int highlightOpacityRevision: 0
  property bool highlightOpacitySaveInFlight: false
  property int activeHighlightOpacitySaveRevision: 0
  property string notice: ""
  property string errorMessage: ""
  property bool customRadioStationSavePending: false
  property string pendingCustomStationName: ""
  property string pendingCustomStationDescription: ""
  property string pendingCustomStationUrl: ""

  signal radioSkinCommitRequested(int skin)

  LightTypography {
    id: typography
    appScale: root.appScale
  }

  readonly property color foreground: LightPalette.popupText
  readonly property color muted: LightPalette.muted
  readonly property color accent: LightPalette.accent
  readonly property var colorOptions: ["fffe00", "ff9900", "cc66ff", "66ccff", "66dd88", "ff6688"]
  // This is the user-visible shortcut reference. Keep it synchronized with
  // every keyboard and modifier-wheel binding under plugin/light/.
  // Each listed action is backed by a saved keybinding. Standard text-field
  // behavior and modifier-wheel gestures are explained below the list.
  readonly property var generalShortcuts: [
    { id: "globalToggle", keys: keybindings.globalToggle || "Super+B", description: I18n.t(appLanguage, "shortcutToggleLight"), editable: true },
    { id: "verseOfTheDay", keys: keybindings.verseOfTheDay || "Super+Alt+V", description: I18n.t(appLanguage, "shortcutVerseOfTheDay"), editable: true },
    { id: "openSettings", keys: keybindings.openSettings || "Ctrl+S", description: I18n.t(appLanguage, "shortcutOpenSettings"), editable: true },
    { id: "settingsReading", keys: keybindings.settingsReading || "Ctrl+Shift+1", description: I18n.t(appLanguage, "shortcutSettingsSection", { section: I18n.t(appLanguage, "settingsReading") }), editable: true },
    { id: "settingsAccount", keys: keybindings.settingsAccount || "Ctrl+Shift+2", description: I18n.t(appLanguage, "shortcutSettingsSection", { section: I18n.t(appLanguage, "account") }), editable: true },
    { id: "settingsBackup", keys: keybindings.settingsBackup || "Ctrl+Shift+3", description: I18n.t(appLanguage, "shortcutSettingsSection", { section: I18n.t(appLanguage, "settingsBackup") }), editable: true },
    { id: "settingsAppearance", keys: keybindings.settingsAppearance || "Ctrl+Shift+4", description: I18n.t(appLanguage, "shortcutSettingsSection", { section: I18n.t(appLanguage, "settingsAppearance") }), editable: true },
    { id: "settingsRadio", keys: keybindings.settingsRadio || "Ctrl+Shift+5", description: I18n.t(appLanguage, "shortcutSettingsSection", { section: I18n.t(appLanguage, "musicPlayerSection") }), editable: true },
    { id: "settingsShortcuts", keys: keybindings.settingsShortcuts || "Ctrl+Shift+6", description: I18n.t(appLanguage, "shortcutSettingsSection", { section: I18n.t(appLanguage, "keyboardShortcuts") }), editable: true },
    { id: "settingsLanguages", keys: keybindings.settingsLanguages || "Ctrl+Shift+7", description: I18n.t(appLanguage, "shortcutSettingsSection", { section: I18n.t(appLanguage, "settingsLanguages") }), editable: true },
    { id: "openLibrary", keys: keybindings.openLibrary || "Ctrl+L", description: I18n.t(appLanguage, "shortcutOpenLibrary"), editable: true },
    { id: "openHistory", keys: keybindings.openHistory || "Ctrl+H", description: I18n.t(appLanguage, "shortcutOpenHistory"), editable: true },
    { id: "openRadio", keys: keybindings.openRadio || "Ctrl+M", description: I18n.t(appLanguage, "shortcutOpenRadio"), editable: true },
    { id: "closeCurrentPage", keys: keybindings.closeCurrentPage || "Escape", description: I18n.t(appLanguage, "shortcutEscape"), editable: true }
  ]
  readonly property var radioShortcuts: [
    { id: "cycleRadioSkin", keys: keybindings.cycleRadioSkin || "Ctrl+Shift+M", description: I18n.t(appLanguage, "shortcutCycleRadioSkin"), editable: true },
    { id: "radioPrevious", keys: keybindings.radioPrevious || "Left", description: I18n.t(appLanguage, "shortcutRadioPrevious"), editable: true },
    { id: "radioNext", keys: keybindings.radioNext || "Right", description: I18n.t(appLanguage, "shortcutRadioNext"), editable: true },
    { id: "radioPlayPause", keys: keybindings.radioPlayPause || "Space", description: I18n.t(appLanguage, "shortcutRadioPlayPause"), editable: true },
    { id: "navigateUp", keys: keybindings.navigateUp || "Up", description: I18n.t(appLanguage, "shortcutRadioStationsUp"), editable: true },
    { id: "navigateDown", keys: keybindings.navigateDown || "Down", description: I18n.t(appLanguage, "shortcutRadioStationsDown"), editable: true },
    { id: "radioVolumeDown", keys: keybindings.radioVolumeDown || "Shift+Left", description: I18n.t(appLanguage, "shortcutRadioVolumeDown"), editable: true },
    { id: "radioVolumeUp", keys: keybindings.radioVolumeUp || "Shift+Right", description: I18n.t(appLanguage, "shortcutRadioVolumeUp"), editable: true }
  ]
  readonly property var readingShortcuts: [
    { id: "textIncrease", keys: keybindings.textIncrease || "Ctrl++", description: I18n.t(appLanguage, "shortcutIncreaseText"), editable: true },
    { id: "textDecrease", keys: keybindings.textDecrease || "Ctrl+-", description: I18n.t(appLanguage, "shortcutDecreaseText"), editable: true },
    { id: "textIncreaseUp", keys: keybindings.textIncreaseUp || "Ctrl+Up", description: I18n.t(appLanguage, "shortcutIncreaseText"), editable: true },
    { id: "textIncreaseRight", keys: keybindings.textIncreaseRight || "Ctrl+Right", description: I18n.t(appLanguage, "shortcutIncreaseText"), editable: true },
    { id: "textDecreaseDown", keys: keybindings.textDecreaseDown || "Ctrl+Down", description: I18n.t(appLanguage, "shortcutDecreaseText"), editable: true },
    { id: "textDecreaseLeft", keys: keybindings.textDecreaseLeft || "Ctrl+Left", description: I18n.t(appLanguage, "shortcutDecreaseText"), editable: true },
    { id: "toggleReaderFontStyle", keys: keybindings.toggleReaderFontStyle || "Ctrl+F", description: I18n.t(appLanguage, "shortcutToggleReaderFontStyle"), editable: true },
    { id: "toggleNightMode", keys: keybindings.toggleNightMode || "Ctrl+D", description: I18n.t(appLanguage, "shortcutNightMode"), editable: true },
    { id: "brightnessIncrease", keys: keybindings.brightnessIncrease || "Ctrl+Alt++", description: I18n.t(appLanguage, "shortcutIncreaseBrightness"), editable: true },
    { id: "brightnessIncreaseUp", keys: keybindings.brightnessIncreaseUp || "Ctrl+Alt+Up", description: I18n.t(appLanguage, "shortcutIncreaseBrightness"), editable: true },
    { id: "brightnessIncreaseRight", keys: keybindings.brightnessIncreaseRight || "Ctrl+Alt+Right", description: I18n.t(appLanguage, "shortcutIncreaseBrightness"), editable: true },
    { id: "brightnessDecrease", keys: keybindings.brightnessDecrease || "Ctrl+Alt+-", description: I18n.t(appLanguage, "shortcutDecreaseBrightness"), editable: true },
    { id: "brightnessDecreaseDown", keys: keybindings.brightnessDecreaseDown || "Ctrl+Alt+Down", description: I18n.t(appLanguage, "shortcutDecreaseBrightness"), editable: true },
    { id: "brightnessDecreaseLeft", keys: keybindings.brightnessDecreaseLeft || "Ctrl+Alt+Left", description: I18n.t(appLanguage, "shortcutDecreaseBrightness"), editable: true },
    { id: "appIncrease", keys: keybindings.appIncrease || "Alt++", description: I18n.t(appLanguage, "shortcutIncreaseApp"), editable: true },
    { id: "appIncreaseUp", keys: keybindings.appIncreaseUp || "Alt+Up", description: I18n.t(appLanguage, "shortcutIncreaseApp"), editable: true },
    { id: "appIncreaseRight", keys: keybindings.appIncreaseRight || "Alt+Right", description: I18n.t(appLanguage, "shortcutIncreaseApp"), editable: true },
    { id: "appDecrease", keys: keybindings.appDecrease || "Alt+-", description: I18n.t(appLanguage, "shortcutDecreaseApp"), editable: true },
    { id: "appDecreaseDown", keys: keybindings.appDecreaseDown || "Alt+Down", description: I18n.t(appLanguage, "shortcutDecreaseApp"), editable: true },
    { id: "appDecreaseLeft", keys: keybindings.appDecreaseLeft || "Alt+Left", description: I18n.t(appLanguage, "shortcutDecreaseApp"), editable: true }
  ]
  readonly property var tabShortcuts: [
    { id: "newTab", keys: keybindings.newTab || "Ctrl+T", description: I18n.t(appLanguage, "shortcutNewTab"), editable: true },
    { id: "closeTab", keys: keybindings.closeTab || "Ctrl+W", description: I18n.t(appLanguage, "shortcutCloseTab"), editable: true },
    { id: "nextTab", keys: keybindings.nextTab || "Ctrl+Tab", description: I18n.t(appLanguage, "shortcutNextTab"), editable: true },
    { id: "previousTab", keys: keybindings.previousTab || "Ctrl+Shift+Tab", description: I18n.t(appLanguage, "shortcutPreviousTab"), editable: true },
    { id: "tab1", keys: keybindings.tab1 || "Ctrl+1", description: I18n.t(appLanguage, "shortcutSelectTab", { number: 1 }), editable: true },
    { id: "tab2", keys: keybindings.tab2 || "Ctrl+2", description: I18n.t(appLanguage, "shortcutSelectTab", { number: 2 }), editable: true },
    { id: "tab3", keys: keybindings.tab3 || "Ctrl+3", description: I18n.t(appLanguage, "shortcutSelectTab", { number: 3 }), editable: true },
    { id: "tab4", keys: keybindings.tab4 || "Ctrl+4", description: I18n.t(appLanguage, "shortcutSelectTab", { number: 4 }), editable: true },
    { id: "tab5", keys: keybindings.tab5 || "Ctrl+5", description: I18n.t(appLanguage, "shortcutSelectTab", { number: 5 }), editable: true },
    { id: "tab6", keys: keybindings.tab6 || "Ctrl+6", description: I18n.t(appLanguage, "shortcutSelectTab", { number: 6 }), editable: true },
    { id: "tab7", keys: keybindings.tab7 || "Ctrl+7", description: I18n.t(appLanguage, "shortcutSelectTab", { number: 7 }), editable: true }
  ]
  readonly property var selectorShortcuts: [
    { id: "searchAccept", keys: "Enter", description: I18n.t(appLanguage, "shortcutAccept"), editable: false },
    { id: "searchFocus", keys: "Tab / Shift+Tab", description: I18n.t(appLanguage, "shortcutSearchInlineFocus"), editable: false },
    { id: "searchDismiss", keys: "Escape", description: I18n.t(appLanguage, "shortcutSearchDismiss"), editable: false },
    { id: "searchDeleteWord", keys: "Ctrl+Backspace", description: I18n.t(appLanguage, "shortcutSearchDeleteWord"), editable: false },
    // In text fields Ctrl+Backspace keeps its normal delete-word behavior.
    { id: "freshInput", keys: keybindings.freshInput || "Ctrl+Backspace", description: I18n.t(appLanguage, "shortcutFreshInput"), editable: true }
  ]
  readonly property real settingsBodyPixelSize: typography.body
  readonly property real settingsTitlePixelSize: typography.title
  readonly property real settingsSectionPixelSize: typography.section
  readonly property real settingsBodySmallPixelSize: typography.bodySmall
  readonly property real settingsCaptionPixelSize: typography.caption
  readonly property var managedRadioStations: orderedRadioStations(
    RadioStations.mergedStations(
      visibleBuiltInRadioStations(),
      customRadioStations,
      builtInRadioStations
    )
  )

  signal closed()
  signal appScalePreviewRequested(real scale)
  signal appScaleCommitRequested(real scale)
  signal readerTextScalePreviewRequested(real scale)
  signal readerTextScaleCommitRequested(real scale)
  signal readerFontStyleCommitRequested(string style)
  signal redLettersCommitRequested(bool enabled)
  signal verseOfTheDayCommitRequested(bool enabled)
  signal musicPlayerCommitRequested(bool enabled)
  signal customRadioStationsCommitRequested(var stations, string operation)
  signal hiddenRadioStationIdsCommitRequested(var stationIds, string operation)
  signal radioStationOrderCommitRequested(var stationKeys)
  signal settingsSectionOrderCommitRequested(var sectionIds)
  signal highlightColorSelected(string color)
  signal highlightOpacitySelected(real opacity)
  signal secondaryBibleLanguagesCommitRequested(var languages)
  signal keybindingsCommitRequested(var keybindings)
  signal accountSyncRequested()
  signal authenticationChanged(bool authenticated)
  signal panelCloseRequested()

  visible: opened
  z: 1000

  onSettingsSectionOrderChanged:
    displayedSettingsSectionOrder = normalizedSettingsSectionOrder(settingsSectionOrder)

  function normalizedSettingsSectionOrder(value) {
    var defaults = [
      "reading", "appearance", "radio", "languages", "account", "shortcuts", "backup"
    ]
    var source = value instanceof Array ? value : []
    var seen = ({})
    var result = []
    for (var i = 0; i < source.length; i++) {
      var section = String(source[i] || "")
      if (defaults.indexOf(section) < 0 || seen[section]) continue
      seen[section] = true
      result.push(section)
    }
    for (var j = 0; j < defaults.length; j++)
      if (!seen[defaults[j]]) result.push(defaults[j])
    return result
  }

  function settingsSectionLabel(section) {
    var labels = ({
      reading: "settingsReading",
      appearance: "settingsAppearance",
      radio: "musicPlayerSection",
      languages: "settingsLanguages",
      account: "account",
      shortcuts: "keyboardShortcuts",
      backup: "settingsBackup"
    })
    return labels[String(section || "")] || ""
  }

  function reorderSettingsSection(sourceSection, targetSection, placeAfter) {
    var order = normalizedSettingsSectionOrder(displayedSettingsSectionOrder)
    var from = order.indexOf(String(sourceSection || ""))
    var target = order.indexOf(String(targetSection || ""))
    if (from < 0 || target < 0) return false
    if (String(sourceSection) === String(targetSection)) return false
    var moved = order.splice(from, 1)[0]
    target = order.indexOf(String(targetSection || ""))
    var insertion = target + (placeAfter ? 1 : 0)
    order.splice(Math.max(0, Math.min(order.length, insertion)), 0, moved)
    if (order.join("|") === displayedSettingsSectionOrder.join("|")) return false
    displayedSettingsSectionOrder = order
    settingsSectionOrderCommitRequested(order)
    return true
  }

  function open() {
    opened = true
    versionSearchInput.text = ""
    notice = ""
    errorMessage = ""
    refresh()
    Qt.callLater(forceActiveFocus)
  }

  function close() {
    cancelKeybindingCapture()
    opened = false
    closed()
  }

  function updateKeybinding(name, value) {
    var next = ({})
    for (var key in keybindings) next[key] = keybindings[key]
    next[name] = String(value || "").trim()
    keybindingsCommitRequested(next)
  }

  function beginKeybindingCapture(name) {
    capturingKeybinding = String(name || "")
    pendingKeybinding = ""
    captureModifierPreview = ""
  }

  function cancelKeybindingCapture() {
    capturingKeybinding = ""
    pendingKeybinding = ""
    captureModifierPreview = ""
  }

  function stageKeybinding(shortcut) {
    if (capturingKeybinding === "" || String(shortcut || "") === "") return false
    pendingKeybinding = String(shortcut)
    return true
  }

  function commitKeybindingCapture() {
    if (capturingKeybinding === "" || pendingKeybinding === "") return false
    var name = capturingKeybinding
    var shortcut = pendingKeybinding
    for (var id in keybindings) {
      if (id !== name && String(keybindings[id]).toLowerCase() === shortcut.toLowerCase()) {
        var rows = generalShortcuts.concat(radioShortcuts, readingShortcuts, tabShortcuts, selectorShortcuts)
        var action = id
        for (var i = 0; i < rows.length; i++)
          if (rows[i].id === id) { action = rows[i].description; break }
        showShortcutConflict(shortcut + " " + I18n.t(appLanguage, "shortcutConflictLight", { action: action }))
        return false
      }
    }
    cancelKeybindingCapture()
    updateKeybinding(name, shortcut)
    return true
  }

  function showShortcutConflict(message) {
    shortcutConflictMessage = String(message || "")
    shortcutConflictPopup.open()
    shortcutConflictTimer.restart()
  }

  Timer {
    id: shortcutConflictTimer
    interval: 6500
    onTriggered: shortcutConflictPopup.close()
  }

  QQC.Popup {
    id: shortcutConflictPopup
    objectName: "shortcutConflictPopup"
    parent: root
    x: Math.round((root.width - width) / 2)
    y: Math.round((root.height - height) / 2)
    width: Math.min(root.width - Style.space(32), Style.space(380))
    padding: Style.space(14)
    modal: false
    focus: false
    closePolicy: QQC.Popup.CloseOnEscape | QQC.Popup.CloseOnPressOutside
    background: BorderSurface {
      color: LightPalette.popupBackground
      borderSpec: Border.localOrSurfaceSpec("popups", "border", LightPalette.urgent,
        LightPalette.urgent, Style.normalBorderWidth)
    }
    contentItem: Text {
      text: root.shortcutConflictMessage
      color: LightPalette.popupText
      font.family: Style.font.family
      font.pixelSize: root.settingsBodyPixelSize
      wrapMode: Text.WordWrap
    }
  }

  function scrollByArrow(direction) {
    var target = settingsScroll
    if (!target || target.contentHeight <= target.height) return false
    var maximum = Math.max(0, target.contentHeight - target.height)
    target.contentY = Math.max(0, Math.min(maximum, target.contentY + direction * Style.space(64)))
    return true
  }

  function scrollSettingsByWheel(wheel) {
    var isResizeGesture = Boolean(wheel.modifiers & Qt.ControlModifier)
      || Boolean(wheel.modifiers & Qt.AltModifier)
    // Resize gestures deliberately bubble to Panel.qml. Plain wheel input on
    // a Slider must be consumed here, otherwise Qt changes the slider value
    // before Settings receives the scroll event.
    if (isResizeGesture) return false
    var delta = Number(wheel.pixelDelta.y)
    if (!isFinite(delta) || delta === 0) delta = Number(wheel.angleDelta.y) / 2
    if (!isFinite(delta) || delta === 0) return true
    var maximum = Math.max(0, settingsScroll.contentHeight - settingsScroll.height)
    settingsScroll.contentY = Math.max(0, Math.min(maximum, settingsScroll.contentY - delta))
    return true
  }

  function navigateByArrow(direction) {
    if (settingsPage === "languages" && secondaryLanguagePopup.opened) {
      secondaryLanguagePopup.moveSelection(direction)
      return
    }
    scrollByArrow(direction)
  }

  function shortcutModifiers(event, globalShortcut, released) {
    var mask = event.modifiers
    var modifier = event.key === Qt.Key_Control ? Qt.ControlModifier
      : event.key === Qt.Key_Alt ? Qt.AltModifier
      : event.key === Qt.Key_Shift ? Qt.ShiftModifier
      : [Qt.Key_Meta, Qt.Key_Super_L, Qt.Key_Super_R].indexOf(event.key) >= 0 ? Qt.MetaModifier : 0
    mask = released ? (mask & ~modifier) : (mask | modifier)
    var modifiers = []
    if (mask & Qt.ControlModifier) modifiers.push("Ctrl")
    if (mask & Qt.AltModifier) modifiers.push("Alt")
    if (mask & Qt.ShiftModifier) modifiers.push("Shift")
    if (mask & Qt.MetaModifier) modifiers.push(globalShortcut ? "Super" : "Meta")
    return modifiers
  }

  function shortcutFromEvent(event, globalShortcut, allowUnmodified) {
    if ([Qt.Key_Control, Qt.Key_Alt, Qt.Key_Shift, Qt.Key_Meta,
         Qt.Key_Super_L, Qt.Key_Super_R].indexOf(event.key) >= 0)
      return ""
    var modifiers = shortcutModifiers(event, globalShortcut, false)
    var shiftedDigit = event.key < 128 ? "!@#$%^&*()".indexOf(String.fromCharCode(event.key)) : -1
    var key = ""
    if ((event.modifiers & Qt.ShiftModifier) && shiftedDigit >= 0) {
      key = String((shiftedDigit + 1) % 10)
    } else if ((event.key >= Qt.Key_A && event.key <= Qt.Key_Z)
        || (event.key >= Qt.Key_0 && event.key <= Qt.Key_9)) {
      key = String.fromCharCode(event.key)
    } else if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) key = "Tab"
    else if (event.key === Qt.Key_Left) key = "Left"
    else if (event.key === Qt.Key_Right) key = "Right"
    else if (event.key === Qt.Key_Up) key = "Up"
    else if (event.key === Qt.Key_Down) key = "Down"
    else if (event.key === Qt.Key_Backspace) key = "Backspace"
    else if (event.key === Qt.Key_Escape) key = "Escape"
    else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) key = "Enter"
    else if (event.key === Qt.Key_Space) key = "Space"
    else if (event.key === Qt.Key_Minus) key = "-"
    else if (event.key === Qt.Key_Plus) key = "+"
    else if (event.key === Qt.Key_Equal) key = "="
    else if (event.key === Qt.Key_Comma) key = "Comma"
    else if (event.key === Qt.Key_Period) key = "Period"
    else if (event.key >= Qt.Key_F1 && event.key <= Qt.Key_F35) key = "F" + (event.key - Qt.Key_F1 + 1)
    if (key === "" || (modifiers.length === 0 && allowUnmodified !== true)) return ""
    return modifiers.concat([key]).join("+")
  }

  function resetKeybindings() {
    keybindingsCommitRequested({
      globalToggle: "Super+B", verseOfTheDay: "Super+Alt+V", openSettings: "Ctrl+S",
      settingsReading: "Ctrl+Shift+1",
      settingsAccount: "Ctrl+Shift+2",
      settingsBackup: "Ctrl+Shift+3",
      settingsAppearance: "Ctrl+Shift+4",
      settingsRadio: "Ctrl+Shift+5",
      settingsShortcuts: "Ctrl+Shift+6",
      settingsLanguages: "Ctrl+Shift+7",
      cycleRadioSkin: "Ctrl+Shift+M",
      openRadio: "Ctrl+M", openLibrary: "Ctrl+L", openHistory: "Ctrl+H",
      radioPrevious: "Left", radioNext: "Right", radioPlayPause: "Space",
      closeCurrentPage: "Escape", navigateUp: "Up", navigateDown: "Down",
      freshInput: "Ctrl+Backspace",
      radioVolumeDown: "Shift+Left", radioVolumeUp: "Shift+Right",
      textIncrease: "Ctrl++", textDecrease: "Ctrl+-",
      textIncreaseUp: "Ctrl+Up", textIncreaseRight: "Ctrl+Right",
      textDecreaseDown: "Ctrl+Down", textDecreaseLeft: "Ctrl+Left",
      brightnessIncrease: "Ctrl+Alt++", brightnessDecrease: "Ctrl+Alt+-",
      brightnessIncreaseUp: "Ctrl+Alt+Up", brightnessIncreaseRight: "Ctrl+Alt+Right",
      brightnessDecreaseDown: "Ctrl+Alt+Down", brightnessDecreaseLeft: "Ctrl+Alt+Left",
      toggleReaderFontStyle: "Ctrl+F",
      toggleNightMode: "Ctrl+D",
      appIncrease: "Alt++", appDecrease: "Alt+-",
      appIncreaseUp: "Alt+Up", appIncreaseRight: "Alt+Right",
      appDecreaseDown: "Alt+Down", appDecreaseLeft: "Alt+Left",
      newTab: "Ctrl+T", closeTab: "Ctrl+W",
      nextTab: "Ctrl+Tab", previousTab: "Ctrl+Shift+Tab",
      tab1: "Ctrl+1", tab2: "Ctrl+2", tab3: "Ctrl+3", tab4: "Ctrl+4", tab5: "Ctrl+5",
      tab6: "Ctrl+6", tab7: "Ctrl+7"
    })
  }
  
  function closeCurrentPage() {
    close()
  }

  function languageLabel(value) {
    var language = String(value || "")
    for (var i = 0; i < bibleLanguageOptions.length; i++) {
      var option = bibleLanguageOptions[i] || {}
      if (String(option.value || "") === language)
        return String(option.label || language)
    }
    return language
  }

  function availableSecondaryLanguageOptions() {
    var primary = I18n.bibleLanguage(systemLocale)
    var selected = ({})
    for (var i = 0; i < secondaryBibleLanguages.length; i++)
      selected[String(secondaryBibleLanguages[i])] = true
    var result = []
    for (var optionIndex = 0; optionIndex < bibleLanguageOptions.length; optionIndex++) {
      var option = bibleLanguageOptions[optionIndex] || {}
      var value = String(option.value || "")
      if (!value || value === primary || selected[value]) continue
      result.push(option)
    }
    return result
  }

  function matchingSecondaryLanguageOptions() {
    return BibleData.filterOptions(
      availableSecondaryLanguageOptions(),
      secondaryLanguageInput.text
    ).slice(0, 50)
  }

  function addSecondaryLanguage(option) {
    if (!option) return
    var value = String(option.value || "")
    if (!value) return
    var next = secondaryBibleLanguages.slice(0)
    next.push(value)
    secondaryLanguageInput.text = ""
    secondaryLanguagePopup.close()
    secondaryBibleLanguagesCommitRequested(next)
  }

  function removeSecondaryLanguage(value) {
    var next = []
    for (var i = 0; i < secondaryBibleLanguages.length; i++) {
      if (String(secondaryBibleLanguages[i]) !== String(value))
        next.push(secondaryBibleLanguages[i])
    }
    secondaryBibleLanguagesCommitRequested(next)
  }

  function addCustomRadioStation() {
    if (customRadioStationSavePending) return
    var name = String(customStationNameInput.text || "").trim()
    var description = String(customStationDescriptionInput.text || "").trim()
    var streamUrl = String(customStationUrlInput.text || "").trim()
    errorMessage = ""
    notice = ""
    if (!name) {
      errorMessage = I18n.t(appLanguage, "radioStationNameRequired")
      customStationNameInput.forceActiveFocus()
      return
    }
    if (!/^https?:\/\/[^\s]+$/i.test(streamUrl)) {
      errorMessage = I18n.t(appLanguage, "radioStationUrlInvalid")
      customStationUrlInput.forceActiveFocus()
      return
    }
    var candidateUrlKey = comparableRadioStreamUrl(streamUrl)
    var editIndex = -1
    for (var edit = 0; edit < customRadioStations.length; edit++)
      if (customRadioStations[edit].streamUrl === editingStationUrl) editIndex = edit
    if (editingStationUrl !== "" && editIndex < 0) {
      errorMessage = I18n.t(appLanguage, "radioStationRemoved")
      return
    }
    for (var i = 0; i < managedRadioStations.length; i++) {
      if (managedRadioStations[i].streamUrl !== editingStationUrl
          && comparableRadioStreamUrl(managedRadioStations[i].streamUrl) === candidateUrlKey) {
        errorMessage = I18n.t(appLanguage, "radioStationAlreadyAdded")
        customStationUrlInput.forceActiveFocus()
        return
      }
    }
    var next = customRadioStations.slice(0)
    var station = {
      name: name,
      description: description || I18n.t(appLanguage, "customRadioStation"),
      streamUrl: streamUrl,
      siteUrl: "",
      custom: true
    }
    if (editIndex >= 0) next[editIndex] = station
    else next.push(station)
    pendingEditedStationUrl = editingStationUrl
    pendingEditedStationOrder = managedRadioStations.map(function(item) { return root.stationKey(item) })
    customRadioStationSavePending = true
    pendingCustomStationName = name
    pendingCustomStationDescription = description
    pendingCustomStationUrl = streamUrl
    customRadioStationsCommitRequested(next, editIndex >= 0 ? "edit" : "add")
  }

  function editRadioStation(station) {
    if (customRadioStationSavePending) return
    editingStationUrl = station.streamUrl
    customStationNameInput.text = station.name
    customStationDescriptionInput.text = station.description || ""
    customStationUrlInput.text = station.streamUrl
    settingsScroll.contentY = 0
    customStationNameInput.forceActiveFocus()
  }

  function cancelRadioEdit() {
    if (customRadioStationSavePending) return
    editingStationUrl = ""
    customStationNameInput.text = ""
    customStationDescriptionInput.text = ""
    customStationUrlInput.text = ""
  }

  function startAddingRadioStation() {
    cancelRadioEdit()
    Qt.callLater(function() {
      var editorY = customStationsEditor.mapToItem(settingsColumn, 0, 0).y
      settingsScroll.contentY = Math.max(0, Math.min(
        settingsScroll.contentHeight - settingsScroll.height, editorY
      ))
      customStationNameInput.forceActiveFocus()
    })
  }

  function toggleFavorite(station) {
    var key = stationKey(station)
    var next = favoriteStations.filter(function(item) { return item !== key })
    if (next.length === favoriteStations.length) next.push(key)
    studyOptionsCommitRequested({ favoriteStations: next })
  }

  // Mirror the URL normalizations relevant to stream identity that Node's URL
  // parser performs server-side. The service remains authoritative for less
  // common URL forms and rejects rather than silently dropping a duplicate.
  function comparableRadioStreamUrl(value) {
    return RadioStations.comparableStreamUrl(value)
  }

  function radioSaveOperation(tag, prefix) {
    var fields = String(tag || "").slice(prefix.length).split(":")
    return fields.length > 1 ? fields[1] : "update"
  }

  function finishCustomRadioStationAdd(succeeded) {
    customRadioStationSavePending = false
    if (succeeded
        && String(customStationNameInput.text || "").trim() === pendingCustomStationName
        && String(customStationDescriptionInput.text || "").trim()
          === pendingCustomStationDescription
        && String(customStationUrlInput.text || "").trim() === pendingCustomStationUrl) {
      customStationNameInput.text = ""
      customStationDescriptionInput.text = ""
      customStationUrlInput.text = ""
      editingStationUrl = ""
    }
    pendingCustomStationName = ""
    pendingCustomStationDescription = ""
    pendingCustomStationUrl = ""
  }

  function visibleBuiltInRadioStations() {
    var hidden = ({})
    for (var hiddenIndex = 0; hiddenIndex < hiddenRadioStationIds.length; hiddenIndex++)
      hidden[String(hiddenRadioStationIds[hiddenIndex])] = true
    var result = []
    for (var i = 0; i < builtInRadioStations.length; i++) {
      var station = builtInRadioStations[i] || {}
      if (!hidden[String(station.id || "")]) result.push(station)
    }
    return result
  }

  function stationIndexIn(items, station) {
    var key = stationKey(station)
    for (var i = 0; i < items.length; i++)
      if (stationKey(items[i]) === key) return i
    return -1
  }

  function stationKey(station) {
    if (!station) return ""
    if (station.custom === true)
      return "custom:" + String(station.streamUrl || "").trim().toLowerCase()
    return "builtin:" + String(station.id || "").trim().toLowerCase()
  }

  function orderedRadioStations(availableStations) {
    var source = availableStations instanceof Array ? availableStations : []
    var byKey = ({})
    var result = []
    for (var i = 0; i < source.length; i++) byKey[stationKey(source[i])] = source[i]
    var preferred = radioStationOrder instanceof Array ? radioStationOrder : []
    for (var orderIndex = 0; orderIndex < preferred.length; orderIndex++) {
      var orderedKey = String(preferred[orderIndex] || "").toLowerCase()
      if (!byKey[orderedKey]) continue
      result.push(byKey[orderedKey])
      delete byKey[orderedKey]
    }
    for (var sourceIndex = 0; sourceIndex < source.length; sourceIndex++) {
      var remainingKey = stationKey(source[sourceIndex])
      if (!byKey[remainingKey]) continue
      result.push(source[sourceIndex])
      delete byKey[remainingKey]
    }
    return result
  }

  function reorderRadioStation(fromIndex, insertionIndex) {
    if (fromIndex < 0 || fromIndex >= managedRadioStations.length) return
    var target = Math.max(0, Math.min(managedRadioStations.length, insertionIndex))
    if (fromIndex < target) target--
    if (target === fromIndex) return
    var reordered = managedRadioStations.slice(0)
    var moved = reordered.splice(fromIndex, 1)[0]
    reordered.splice(target, 0, moved)
    var keys = []
    for (var i = 0; i < reordered.length; i++) keys.push(stationKey(reordered[i]))
    radioStationOrderCommitRequested(keys)
  }

  function removeRadioStation(station) {
    if (!station) return
    if (station.custom === true) {
      var nextCustom = []
      var removedUrl = String(station.streamUrl || "")
      for (var i = 0; i < customRadioStations.length; i++) {
        if (String(customRadioStations[i].streamUrl || "") !== removedUrl)
          nextCustom.push(customRadioStations[i])
      }
      customRadioStationsCommitRequested(nextCustom, "remove")
    } else {
      var stationId = String(station.id || "")
      if (!stationId || hiddenRadioStationIds.indexOf(stationId) >= 0) return
      var nextHidden = hiddenRadioStationIds.slice(0)
      nextHidden.push(stationId)
      hiddenRadioStationIdsCommitRequested(nextHidden, "remove")
    }
    notice = ""
  }

  function restoreDefaultRadioStations() {
    if (hiddenRadioStationIds.length === 0) return
    notice = ""
    hiddenRadioStationIdsCommitRequested([], "restore")
  }

  function refresh() {
    if (!api) return
    accountApi.get("/v1/auth/status", "settings.auth")
    if (authenticated) api.get("/v1/downloads", "settings.downloads")
    api.get(
      "/v1/user-data/preferences/highlight-color",
      "settings.color:" + highlightColorRevision
    )
    api.get(
      "/v1/user-data/preferences/highlight-opacity",
      "settings.opacity:" + highlightOpacityRevision
    )
  }

  function toggleAccount() {
    if (!api || signInStarting) return
    errorMessage = ""
    if (authenticated) {
      accountApi.post("/v1/auth/logout", {}, "settings.logout")
      notice = I18n.t(appLanguage, "signingOut")
    } else {
      signInStarting = true
      signInPending = true
      accountApi.post("/v1/auth/start", { permissions: ["highlights"], open: false }, "settings.signin")
      notice = I18n.t(appLanguage, "openingSignIn")
    }
  }

  function profileInitials() {
    var profile = root.accountProfile || ({})
    var source = String(profile.name || profile.email || "").trim()
    if (!source) return "?"
    var words = source.split(/\s+/)
    return String(words[0].charAt(0) + (words.length > 1 ? words[words.length - 1].charAt(0) : "")).toUpperCase()
  }

  function downloadSelected() {
    if (!api || selectedVersion === "") return
    downloadVersion(selectedVersion, selectedVersionLabel)
  }

  function requestVersionCatalog() {
    if (!api || !authenticated || versionCatalogRequested) return
    versionCatalogRequested = true
    versionCatalogLoading = true
    catalogApi.get("/v1/versions?language=*&mode=auto", "settings.version-catalog")
  }

  function packageForVersion(version) {
    for (var i = 0; i < packages.length; i++) {
      if (String(packages[i].version) === String(version)) return packages[i]
    }
    return null
  }

  function downloadVersion(version, label) {
    if (!api || String(version) === "") return
    errorMessage = ""
    notice = I18n.t(appLanguage, "queuingTranslation", {
      translation: label || (I18n.t(appLanguage, "version") + " " + version)
    })
    api.post("/v1/downloads", {
      version: Number(version),
      format: "html",
      includeHeadings: true,
      includeNotes: true,
      refresh: false
    }, "settings.download-add")
  }

  function removePackage(version) {
    if (!api) return
    notice = I18n.t(appLanguage, "removingPackage")
    api.remove("/v1/downloads/" + encodeURIComponent(String(version)), "settings.download-remove")
  }

  function resumePackage(item) {
    if (!api || !item || item.status !== "paused") return
    errorMessage = ""
    notice = I18n.t(appLanguage, "resumingPackage", {
      translation: packageLabel(item)
    })
    api.post(
      "/v1/downloads/" + encodeURIComponent(String(item.version)) + "/resume",
      {},
      "settings.download-resume:" + String(item.version)
    )
  }

  function setHighlightColor(color) {
    var normalized = normalizedHighlightColor(color)
    if (!normalized || normalized === highlightColor) return
    highlightColorRevision += 1
    highlightColor = normalized
    highlightColorSelected(normalized)
    saveHighlightColor()
  }

  function normalizedHighlightColor(color) {
    var normalized = String(color || "").replace(/^#/, "").toLowerCase()
    return /^[0-9a-f]{6}$/.test(normalized) ? normalized : ""
  }

  function saveHighlightColor() {
    if (!api || highlightColorSaveInFlight) return
    highlightColorSaveInFlight = true
    activeHighlightColorSaveRevision = highlightColorRevision
    api.put(
      "/v1/user-data/preferences/highlight-color",
      { color: highlightColor },
      "settings.color-save:" + activeHighlightColorSaveRevision
    )
  }

  function setHighlightOpacity(opacity, persist) {
    var normalized = normalizedHighlightOpacity(opacity)
    if (normalized === null) return
    if (normalized !== highlightOpacity) {
      highlightOpacityRevision += 1
      highlightOpacity = normalized
      highlightOpacitySelected(normalized)
    }
    if (persist === true) saveHighlightOpacity()
  }

  function normalizedHighlightOpacity(opacity) {
    var numeric = Number(opacity)
    if (!isFinite(numeric) || numeric < 0.2 || numeric > 0.75) return null
    return Math.round(numeric * 100) / 100
  }

  function saveHighlightOpacity() {
    if (!api || highlightOpacitySaveInFlight) return
    highlightOpacitySaveInFlight = true
    activeHighlightOpacitySaveRevision = highlightOpacityRevision
    api.put(
      "/v1/user-data/preferences/highlight-opacity",
      { opacity: highlightOpacity },
      "settings.opacity-save:" + activeHighlightOpacitySaveRevision
    )
  }

  function packageLabel(item) {
    if (!item) return I18n.t(appLanguage, "translation")
    return item.abbreviation || item.title
      || (I18n.t(appLanguage, "version") + " " + item.version)
  }

  function statusLabel(item) {
    if (!item) return ""
    var progress = Math.round(Number(item.progress || 0) * 100)
    var statusKey = "status" + String(item.status || "unknown")
      .charAt(0).toUpperCase() + String(item.status || "unknown").slice(1)
    var localizedStatus = I18n.t(appLanguage, statusKey)
    if (localizedStatus === statusKey) localizedStatus = I18n.t(appLanguage, "unknown")
    return localizedStatus + (item.status === "complete" ? "" : " · " + progress + "%")
  }

  Keys.priority: Keys.BeforeItem
  Keys.onPressed: function(event) {
    if (capturingKeybinding !== "" || secondaryLanguageInput.activeFocus
        || secondaryLanguagePopup.opened || customStationNameInput.activeFocus
        || customStationDescriptionInput.activeFocus
        || customStationUrlInput.activeFocus)
      return
    if (event.key === Qt.Key_Escape) {
      root.closeCurrentPage()
      event.accepted = true
    } else if (event.key === Qt.Key_Up || event.key === Qt.Key_Down) {
      event.accepted = root.scrollByArrow(event.key === Qt.Key_Up ? -1 : 1)
    }
  }

  LightApi {
    id: accountApi
    baseUrl: root.api && root.api.baseUrl ? root.api.baseUrl : "http://127.0.0.1:8788"
    appLanguage: root.appLanguage
    onSucceeded: function(tag, payload, status) { root.handleSettingsSuccess(tag, payload, status) }
    onFailed: function(tag, message, status, payload) { root.handleSettingsFailure(tag, message, status, payload) }
  }

  LightApi {
    id: catalogApi
    baseUrl: root.api && root.api.baseUrl ? root.api.baseUrl : "http://127.0.0.1:8788"
    appLanguage: root.appLanguage
    onSucceeded: function(tag, payload, status) { root.handleSettingsSuccess(tag, payload, status) }
    onFailed: function(tag, message, status, payload) { root.handleSettingsFailure(tag, message, status, payload) }
  }

  Timer {
    interval: root.signInPending || root.packages.some(function(item) {
      return item.status === "downloading" || item.status === "queued"
    }) ? 2500 : 30000
    repeat: true
    // The bar popup closes when the browser takes focus. Keep polling only
    // while a sign-in is in progress so the completed native callback is
    // recognized even though the Settings card is temporarily hidden.
    running: root.opened || root.signInPending
    onTriggered: {
      if (!root.api) return
      if (!accountApi.busy) accountApi.get("/v1/auth/status", "settings.auth")
      if (root.opened && root.authenticated && !root.api.busy)
        root.api.get("/v1/downloads", "settings.downloads")
    }
  }

  Connections {
    target: root.api

    function onSucceeded(tag, payload, status) { root.handleSettingsSuccess(tag, payload, status) }
    function onFailed(tag, message, status, payload) { root.handleSettingsFailure(tag, message, status, payload) }
  }

  function handleSettingsSuccess(tag, payload, status) {
    if (tag === "settings.auth") {
      var wasAuthenticated = root.authenticated
      root.authenticated = payload && payload.authenticated === true
      if (root.authenticated !== wasAuthenticated)
        root.authenticationChanged(root.authenticated)
      root.authConfigured = payload && payload.configured === true
      var callbackPending = payload && payload.pending === true
      root.authExpiry = payload && payload.expiresAt ? String(payload.expiresAt) : ""
      root.accountProfile = payload && payload.profile && typeof payload.profile === "object"
        ? payload.profile
        : ({})
      if (!wasAuthenticated && root.authenticated) {
        root.signInPending = false
        root.notice = I18n.t(root.appLanguage, "signedInNotice")
        root.accountSyncRequested()
        root.api.get("/v1/downloads", "settings.downloads")
        if (root.versionSearchQuery.trim() !== "") root.requestVersionCatalog()
      } else if (wasAuthenticated && !root.authenticated) {
        root.packages = []
        root.versionCatalog = []
        root.versionCatalogRequested = false
      } else if (!root.signInStarting && root.signInPending && !callbackPending) {
        root.signInPending = false
        root.notice = ""
      }
      if (!root.signInStarting && payload && payload.error) {
        root.errorMessage = String(payload.error.message)
        root.notice = ""
      }
    } else if (tag === "settings.version-catalog") {
      var catalogData = payload && payload.data !== undefined ? payload.data : payload
      root.versionCatalog = catalogData instanceof Array ? catalogData
        : catalogData && catalogData.data instanceof Array ? catalogData.data : []
      root.versionCatalogLoading = false
    } else if (tag === "settings.downloads") {
      root.packages = payload && payload.packages instanceof Array ? payload.packages : []
    } else if (String(tag).indexOf("settings.color:") === 0) {
      var colorRevision = Number(String(tag).slice("settings.color:".length))
      var storedColor = root.normalizedHighlightColor(
        payload && payload.defaultHighlightColor
      )
      if (colorRevision === root.highlightColorRevision && storedColor) {
        root.highlightColor = storedColor
        root.highlightColorSelected(storedColor)
      }
    } else if (String(tag).indexOf("settings.opacity:") === 0) {
      var opacityRevision = Number(String(tag).slice("settings.opacity:".length))
      var storedOpacity = root.normalizedHighlightOpacity(
        payload && payload.defaultHighlightOpacity
      )
      if (opacityRevision === root.highlightOpacityRevision && storedOpacity !== null) {
        root.highlightOpacity = storedOpacity
        root.highlightOpacitySelected(storedOpacity)
      }
    } else if (tag === "settings.signin") {
      root.signInStarting = false
      // Launch from the graphical client: systemd services may have no
      // DISPLAY/WAYLAND_DISPLAY even when the desktop is already running.
      if (!payload || !payload.authorizationUrl || !Qt.openUrlExternally(String(payload.authorizationUrl))) {
        root.signInPending = false
        root.notice = ""
        root.errorMessage = I18n.t(root.appLanguage, "browserOpenFailed")
        return
      }
      root.signInPending = true
      root.notice = I18n.t(root.appLanguage, "finishSignIn")
    } else if (tag === "settings.logout") {
      root.authenticated = false
      root.authenticationChanged(false)
      root.packages = []
      root.authConfigured = false
      root.signInPending = false
      root.accountProfile = ({})
      root.notice = I18n.t(root.appLanguage, "signedOutNotice")
    } else if (tag === "settings.download-add") {
      root.notice = I18n.t(root.appLanguage, "downloadQueued")
      root.api.get("/v1/downloads", "settings.downloads")
    } else if (String(tag).indexOf("settings.download-resume:") === 0) {
      root.notice = I18n.t(root.appLanguage, "downloadResumed")
      root.api.get("/v1/downloads", "settings.downloads")
    } else if (tag === "settings.download-remove") {
      root.notice = I18n.t(root.appLanguage, "packageRemoved")
      root.api.get("/v1/downloads", "settings.downloads")
    } else if (String(tag).indexOf("settings.custom-radio-stations-save:") === 0) {
      var customOperation = root.radioSaveOperation(
        tag, "settings.custom-radio-stations-save:"
      )
      if (customOperation === "add" || customOperation === "edit") {
        if (customOperation === "edit" && pendingEditedStationUrl !== "") {
          var oldKey = "custom:" + pendingEditedStationUrl.toLowerCase()
          var newKey = "custom:" + comparableRadioStreamUrl(pendingCustomStationUrl).toLowerCase()
          if (oldKey !== newKey) {
            radioStationOrderCommitRequested(pendingEditedStationOrder.map(function(key) {
              return key === oldKey ? newKey : key
            }))
            if (favoriteStations.indexOf(oldKey) >= 0)
              studyOptionsCommitRequested({ favoriteStations: favoriteStations.map(function(key) { return key === oldKey ? newKey : key }) })
          }
        }
        root.finishCustomRadioStationAdd(true)
        root.notice = I18n.t(root.appLanguage, customOperation === "edit" ? "radioStationUpdated" : "radioStationAdded")
      } else if (customOperation === "remove") {
        root.notice = I18n.t(root.appLanguage, "radioStationRemoved")
      }
      root.errorMessage = ""
    } else if (String(tag).indexOf("settings.hidden-radio-stations-save:") === 0) {
      var hiddenOperation = root.radioSaveOperation(
        tag, "settings.hidden-radio-stations-save:"
      )
      root.notice = hiddenOperation === "restore"
        ? I18n.t(root.appLanguage, "defaultRadioStationsRestored")
        : I18n.t(root.appLanguage, "radioStationRemoved")
      root.errorMessage = ""
    } else if (String(tag).indexOf("settings.color-save:") === 0) {
      var savedRevision = Number(String(tag).slice("settings.color-save:".length))
      root.highlightColorSaveInFlight = false
      if (savedRevision === root.highlightColorRevision) {
        var savedColor = root.normalizedHighlightColor(
          payload && payload.defaultHighlightColor
        )
        if (savedColor) {
          root.highlightColor = savedColor
          root.highlightColorSelected(savedColor)
        }
        root.notice = I18n.t(root.appLanguage, "colorSaved")
      } else {
        root.saveHighlightColor()
      }
    } else if (String(tag).indexOf("settings.opacity-save:") === 0) {
      var savedOpacityRevision = Number(
        String(tag).slice("settings.opacity-save:".length)
      )
      root.highlightOpacitySaveInFlight = false
      if (savedOpacityRevision === root.highlightOpacityRevision) {
        var savedOpacity = root.normalizedHighlightOpacity(
          payload && payload.defaultHighlightOpacity
        )
        if (savedOpacity !== null) {
          root.highlightOpacity = savedOpacity
          root.highlightOpacitySelected(savedOpacity)
        }
        root.notice = I18n.t(root.appLanguage, "highlightOpacitySaved")
      } else {
        root.saveHighlightOpacity()
      }
    }
  }

  function handleSettingsFailure(tag, message, status, payload) {
    if (String(tag).indexOf("settings.") !== 0) return
    if (tag === "settings.version-catalog") {
      root.versionCatalogLoading = false
      root.versionCatalogRequested = false
    }
    root.errorMessage = message
    root.notice = ""
    if (String(tag).indexOf("settings.custom-radio-stations-save:") === 0
        && ["add", "edit"].indexOf(root.radioSaveOperation(tag, "settings.custom-radio-stations-save:")) >= 0)
      root.finishCustomRadioStationAdd(false)
    if (tag === "settings.auth") {
      root.authenticated = false
      root.authenticationChanged(false)
    }
    if (tag === "settings.signin") {
      root.signInStarting = false
      root.signInPending = false
      root.notice = ""
    }
    if (String(tag).indexOf("settings.color-save:") === 0) {
      root.highlightColorSaveInFlight = false
      if (root.activeHighlightColorSaveRevision !== root.highlightColorRevision)
        root.saveHighlightColor()
    }
    if (String(tag).indexOf("settings.opacity-save:") === 0) {
      root.highlightOpacitySaveInFlight = false
      if (root.activeHighlightOpacitySaveRevision !== root.highlightOpacityRevision)
        root.saveHighlightOpacity()
    }
  }

  Rectangle {
    anchors.fill: parent
    color: Util.alpha(LightPalette.background, 0.72)

    MouseArea {
      anchors.fill: parent
      onClicked: root.close()
    }
  }

  Rectangle {
    id: card
    anchors.fill: parent
    color: LightPalette.popupBackground
    gradient: Gradient {
      GradientStop { position: 0; color: LightPalette.nightMode ? "#000000" : Qt.tint(LightPalette.popupBackground, Util.alpha(root.foreground, 0.035)) }
      GradientStop { position: 0.25; color: LightPalette.popupBackground }
      GradientStop { position: 1; color: LightPalette.popupBackground }
    }
    Rectangle {
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.top: parent.top
      height: 1
      color: Util.alpha(root.accent, 0.38)
    }

    MouseArea { anchors.fill: parent; onClicked: {} }

    Item {
      anchors.fill: parent
      anchors.margins: typography.panelPadding

      Row {
        id: modalHeader
        width: parent.width
        spacing: typography.controlGap

        Column {
          width: Math.max(1, parent.width - closeButton.width - parent.spacing)
          spacing: typography.labelGap

          Text {
            text: I18n.t(root.appLanguage, "settingsTitle")
            color: root.foreground
            font.family: Style.font.family
            font.pixelSize: root.settingsTitlePixelSize
            font.bold: true
          }
        }

        PixelIconButton {
          id: closeButton
          pixelIconName: "close"
          iconSize: Style.space(14)
          tooltipText: I18n.t(root.appLanguage, "closeSettings")
          focusable: true
          foreground: root.foreground
          accent: root.accent
          onClicked: root.panelCloseRequested()
        }
      }

      Flow {
        id: settingsNavigation
        anchors.top: modalHeader.bottom
        anchors.topMargin: typography.controlGap
        width: parent.width
        spacing: typography.controlGap
        Repeater {
          model: root.displayedSettingsSectionOrder
          delegate: Item {
            id: settingsNavigationItem
            required property int index
            required property string modelData
            width: settingsNavigationButton.implicitWidth
            height: settingsNavigationButton.implicitHeight
            z: settingsNavigationDrag.drag.active ? 30 : 1

            DropArea {
              id: settingsNavigationDropArea
              anchors.fill: parent
              keys: ["light-settings-section"]
              onDropped: function(drop) {
                var sourceSection = root.draggedSettingsSection
                var targetSection = settingsNavigationItem.modelData
                var placeAfter = drop.x > settingsNavigationDropArea.width / 2
                Qt.callLater(function() {
                  root.reorderSettingsSection(sourceSection, targetSection, placeAfter)
                })
                drop.acceptProposedAction()
              }
            }

            Rectangle {
              anchors.top: parent.top
              anchors.bottom: parent.bottom
              anchors.left: settingsNavigationDropArea.containsDrag
                && settingsNavigationDropArea.drag.x <= settingsNavigationDropArea.width / 2 ? parent.left : undefined
              anchors.right: settingsNavigationDropArea.containsDrag
                && settingsNavigationDropArea.drag.x > settingsNavigationDropArea.width / 2 ? parent.right : undefined
              width: Math.max(2, Style.normalBorderWidth * 2)
              visible: settingsNavigationDropArea.containsDrag
              color: root.accent
              z: 20
            }

            PixelButton {
              id: settingsNavigationButton
              objectName: "settings-nav-" + settingsNavigationItem.modelData
              text: I18n.t(
                root.appLanguage,
                root.settingsSectionLabel(settingsNavigationItem.modelData)
              )
              foreground: root.settingsPage === settingsNavigationItem.modelData
                ? root.accent : root.muted
              fontSize: root.settingsBodySmallPixelSize
              focusable: true
              z: settingsNavigationDrag.drag.active ? 30 : 1
              opacity: settingsNavigationDrag.drag.active ? 0.82 : 1
              hasCursor: settingsNavigationDrag.containsMouse
              Drag.active: settingsNavigationDrag.drag.active
              Drag.source: settingsNavigationItem
              Drag.keys: ["light-settings-section"]
              Drag.supportedActions: Qt.MoveAction
              Drag.hotSpot.x: width / 2
              Drag.hotSpot.y: height / 2
              onClicked: {
                root.cancelKeybindingCapture()
                root.settingsPage = settingsNavigationItem.modelData
                settingsScroll.contentY = 0
              }

              MouseArea {
                id: settingsNavigationDrag
                anchors.fill: parent
                z: 100
                hoverEnabled: true
                preventStealing: true
                cursorShape: drag.active ? Qt.ClosedHandCursor : Qt.OpenHandCursor
                drag.target: settingsNavigationButton
                onPressed: root.draggedSettingsSection = settingsNavigationItem.modelData
                onReleased: {
                  if (drag.active) settingsNavigationButton.Drag.drop()
                  settingsNavigationButton.x = 0
                  settingsNavigationButton.y = 0
                  root.draggedSettingsSection = ""
                }
                onCanceled: {
                  settingsNavigationButton.Drag.cancel()
                  settingsNavigationButton.x = 0
                  settingsNavigationButton.y = 0
                  root.draggedSettingsSection = ""
                }
                onClicked: settingsNavigationButton.clicked()
              }
            }
          }
        }
      }

      Flickable {
        id: settingsScroll
        objectName: "settingsScroll"
        anchors.top: settingsNavigation.bottom
        anchors.topMargin: typography.panelGap
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        contentWidth: width
        contentHeight: settingsColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        flickableDirection: Flickable.VerticalFlick
        interactive: contentHeight > height

        Column {
          id: settingsColumn
          objectName: "settingsColumn"
          width: settingsScroll.width
          spacing: typography.panelGap

          Text {
            objectName: "accountStatus"
            width: parent.width
            visible: root.notice !== "" || root.errorMessage !== ""
            text: root.errorMessage || root.notice
            textFormat: Text.PlainText
            color: root.errorMessage !== "" ? LightPalette.urgent : root.accent
            font.family: Style.font.family
            font.pixelSize: root.settingsCaptionPixelSize
            wrapMode: Text.WordWrap
          }

          Column {
            id: shortcutsSettingsPage
            objectName: "shortcutsSettingsPage"
            width: parent.width
            spacing: typography.panelGap
            visible: root.settingsPage === "shortcuts"

            PixelSectionHeader {
              width: parent.width
              text: I18n.t(root.appLanguage, "keyboardShortcuts")
              fontSize: root.settingsSectionPixelSize
              foreground: root.foreground
            }

            Text {
              width: parent.width
              text: I18n.t(root.appLanguage, "shortcutsSubtitle")
              color: root.muted
              font.family: Style.font.family
              font.pixelSize: root.settingsCaptionPixelSize
              wrapMode: Text.WordWrap
            }

            Text {
              width: parent.width
              text: I18n.t(root.appLanguage, "shortcutEditHint")
              color: root.muted
              font.family: Style.font.family
              font.pixelSize: root.settingsCaptionPixelSize
              wrapMode: Text.WordWrap
            }

            PixelSectionHeader {
              width: parent.width
              text: I18n.t(root.appLanguage, "general")
              fontSize: root.settingsSectionPixelSize
              foreground: root.foreground
            }

            Repeater {
              model: root.generalShortcuts
              delegate: shortcutRowDelegate
            }

            PanelSeparator { width: parent.width; foreground: root.foreground }

            PixelSectionHeader {
              width: parent.width
              text: I18n.t(root.appLanguage, "radioShortcutsSection")
              fontSize: root.settingsSectionPixelSize
              foreground: root.foreground
            }

            Repeater {
              model: root.radioShortcuts
              delegate: shortcutRowDelegate
            }

            PanelSeparator { width: parent.width; foreground: root.foreground }

            PixelSectionHeader {
              width: parent.width
              text: I18n.t(root.appLanguage, "reading")
              fontSize: root.settingsSectionPixelSize
              foreground: root.foreground
            }

            Repeater {
              model: root.readingShortcuts
              delegate: shortcutRowDelegate
            }

            PanelSeparator { width: parent.width; foreground: root.foreground }

            PixelSectionHeader {
              width: parent.width
              text: I18n.t(root.appLanguage, "tabs")
              fontSize: root.settingsSectionPixelSize
              foreground: root.foreground
            }

            Repeater {
              model: root.tabShortcuts
              delegate: shortcutRowDelegate
            }

            PanelSeparator { width: parent.width; foreground: root.foreground }

            PixelSectionHeader {
              width: parent.width
              text: I18n.t(root.appLanguage, "selectorSection")
              fontSize: root.settingsSectionPixelSize
              foreground: root.foreground
            }

            Repeater {
              model: root.selectorShortcuts
              delegate: shortcutRowDelegate
            }

            Text {
              width: parent.width
              text: I18n.t(root.appLanguage, "shortcutNativeControls")
              color: root.muted
              font.family: Style.font.family
              font.pixelSize: root.settingsCaptionPixelSize
              wrapMode: Text.WordWrap
            }

            Item {
              width: parent.width
              height: shortcutsResetButton.implicitHeight

              SettingsControlButton {
                id: shortcutsResetButton
                anchors.right: parent.right
                text: I18n.t(root.appLanguage, "restoreDefaults")
                fontSize: root.settingsBodySmallPixelSize
                tooltipText: I18n.t(root.appLanguage, "restoreShortcutDefaults")
                focusable: true
                foreground: root.muted
                accent: root.accent
                onClicked: root.resetKeybindings()
              }
            }
          }

          SettingsToggleRow {
            visible: root.settingsPage === "reading"
            title: I18n.t(root.appLanguage, "compactSearch")
            helpText: I18n.t(root.appLanguage, "compactSearchHelp")
            checked: root.resumeReading
            foreground: root.foreground
            muted: root.muted
            accent: root.accent
            bodyFontSize: root.settingsBodyPixelSize
            captionFontSize: root.settingsCaptionPixelSize
            onToggleRequested: function(checked) { root.studyOptionsCommitRequested({ resumeReading: checked }) }
          }
          SettingsToggleRow {
            visible: root.settingsPage === "reading"
            title: I18n.t(root.appLanguage, "autoOpenReferences")
            helpText: I18n.t(root.appLanguage, "autoOpenReferencesHelp")
            checked: root.autoOpenReferences
            foreground: root.foreground
            muted: root.muted
            accent: root.accent
            bodyFontSize: root.settingsBodyPixelSize
            captionFontSize: root.settingsCaptionPixelSize
            onToggleRequested: function(checked) { root.studyOptionsCommitRequested({ autoOpenReferences: checked }) }
          }
          BackupControls {
            width: parent.width
            visible: root.settingsPage === "backup"
            api: root.api
            appLanguage: root.appLanguage
            onRestored: root.backupRestored()
          }
          Column {
            width: parent.width
            spacing: typography.panelGap
            visible: root.settingsPage === "languages"
          PixelSectionHeader {
            width: parent.width
            text: I18n.t(root.appLanguage, "findBibleVersions")
            fontSize: root.settingsSectionPixelSize
            foreground: root.foreground
          }

          LightTextField {
            id: versionSearchInput
            objectName: "settingsVersionSearchInput"
            width: parent.width
            height: Math.max(Style.space(24), root.settingsBodySmallPixelSize + Style.spacing.xxs * 2)
            verticalPadding: Style.spacing.xxs
            placeholderText: I18n.t(root.appLanguage, "searchBibleVersions")
            fontSize: root.settingsBodySmallPixelSize
            onTextChanged: {
              root.versionSearchQuery = text
              if (text.trim() !== "") root.requestVersionCatalog()
            }
          }

          Text {
            width: parent.width
            visible: !root.authenticated || root.versionCatalogLoading
              || (root.versionSearchQuery.trim() !== "" && root.versionCatalogRequested
                && root.versionSearchMatches.length === 0)
            text: !root.authenticated ? I18n.t(root.appLanguage, "signInToFindVersions")
              : root.versionCatalogLoading ? I18n.t(root.appLanguage, "loading")
              : I18n.t(root.appLanguage, "noMatchingVersions")
            color: root.muted
            font.family: Style.font.family
            font.pixelSize: root.settingsCaptionPixelSize
            wrapMode: Text.WordWrap
          }

          Repeater {
            model: root.versionSearchMatches.slice(0, 30)
            delegate: Column {
              id: versionResult
              required property var modelData
              required property int index
              width: settingsColumn.width
              spacing: Style.spacing.xs
              readonly property var currentPackage: root.packageForVersion(modelData.id)

              Row {
                width: parent.width
                spacing: Style.spacing.controlGap
                Column {
                  width: Math.max(1, parent.width - versionDownloadButton.width - parent.spacing)
                  Text {
                    width: parent.width
                    text: String(versionResult.modelData.localized_abbreviation
                      || versionResult.modelData.abbreviation || versionResult.modelData.id)
                    color: root.foreground
                    font.family: Style.font.family
                    font.pixelSize: root.settingsBodyPixelSize
                    font.bold: true
                    elide: Text.ElideRight
                  }
                  Text {
                    width: parent.width
                    text: String(versionResult.modelData.localized_title
                      || versionResult.modelData.title || "")
                    color: root.muted
                    font.family: Style.font.family
                    font.pixelSize: root.settingsCaptionPixelSize
                    elide: Text.ElideRight
                  }
                }
                SettingsControlButton {
                  id: versionDownloadButton
                  text: versionResult.currentPackage
                    ? root.statusLabel(versionResult.currentPackage)
                    : I18n.t(root.appLanguage, "download")
                  fontSize: root.settingsBodySmallPixelSize
                  focusable: true
                  enabled: !versionResult.currentPackage
                  foreground: root.accent
                  accent: root.accent
                  onClicked: root.downloadVersion(versionResult.modelData.id,
                    String(versionResult.modelData.localized_abbreviation
                      || versionResult.modelData.abbreviation || versionResult.modelData.id))
                }
              }
              PanelSeparator {
                width: parent.width
                visible: versionResult.index < Math.min(30, root.versionSearchMatches.length) - 1
                foreground: root.foreground
              }
            }
          }

          Text {
            width: parent.width
            visible: root.versionSearchMatches.length > 30
            text: I18n.t(root.appLanguage, "refineVersionSearch")
            color: root.muted
            font.family: Style.font.family
            font.pixelSize: root.settingsCaptionPixelSize
            wrapMode: Text.WordWrap
          }

          PixelSectionHeader {
            width: parent.width
            text: I18n.t(root.appLanguage, "language")
            fontSize: root.settingsSectionPixelSize
            foreground: root.foreground
          }

          Text {
            width: parent.width
            text: I18n.t(root.appLanguage, "primaryBibleLanguage")
            color: root.foreground
            font.family: Style.font.family
            font.pixelSize: root.settingsBodyPixelSize
            font.bold: true
          }

          Text {
            width: parent.width
            text: root.languageLabel(I18n.bibleLanguage(root.systemLocale))
              + " (" + I18n.bibleLanguage(root.systemLocale) + ")"
            color: root.accent
            font.family: Style.font.family
            font.pixelSize: root.settingsBodyPixelSize
          }

          Text {
            width: parent.width
            text: I18n.t(root.appLanguage, "additionalBibleLanguages")
            color: root.foreground
            font.family: Style.font.family
            font.pixelSize: root.settingsBodyPixelSize
            font.bold: true
          }

          Item {
            id: secondaryLanguageField
            width: parent.width
            implicitHeight: Style.spacing.controlHeight

            BorderSurface {
              anchors.fill: parent
              color: LightPalette.popupBackground
              borderSpec: Border.localOrSurfaceSpec(
                "popups", "border", LightPalette.popupBorder, LightPalette.popupBorder,
                Style.normalBorderWidth
              )
              radius: 0
            }

            TextInput {
              id: secondaryLanguageInput
              anchors.fill: parent
              anchors.leftMargin: Style.spacing.controlPaddingX
              anchors.rightMargin: Style.spacing.controlPaddingX
              color: root.foreground
              selectionColor: Style.selectionFillFor(root.foreground, root.accent, LightPalette.urgent)
              selectedTextColor: root.foreground
              font.family: Style.font.family
              font.pixelSize: root.settingsBodyPixelSize
              verticalAlignment: TextInput.AlignVCenter
              selectByMouse: true
              clip: true
              activeFocusOnTab: true

              Text {
                anchors.fill: parent
                verticalAlignment: Text.AlignVCenter
                visible: secondaryLanguageInput.text === ""
                text: I18n.t(root.appLanguage, "addLanguage")
                color: root.muted
                font: secondaryLanguageInput.font
              }

              onTextEdited: {
                if (!secondaryLanguagePopup.opened) secondaryLanguagePopup.open()
              }

              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Down || event.key === Qt.Key_Up) {
                  if (!secondaryLanguagePopup.opened) secondaryLanguagePopup.open()
                  event.accepted = secondaryLanguagePopup.moveSelection(
                    event.key === Qt.Key_Up ? -1 : 1
                  )
                } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                  event.accepted = secondaryLanguagePopup.chooseCurrent()
                }
              }
            }

            MouseArea {
              anchors.fill: parent
              cursorShape: Qt.PointingHandCursor
              onClicked: {
                secondaryLanguageInput.forceActiveFocus()
                secondaryLanguagePopup.open()
              }
            }

            InlineOptionPopup {
              id: secondaryLanguagePopup
              focusOnOpen: false
              x: 0
              y: secondaryLanguageField.height + Style.spacing.xxs
              width: secondaryLanguageField.width
              options: root.matchingSecondaryLanguageOptions()
              emptyText: I18n.t(root.appLanguage, "noMatchingLanguages")
              foreground: root.foreground
              accent: root.accent
              rowHeight: Style.spacing.controlHeight
              fontPixelSize: root.settingsBodyPixelSize
              onSelected: function(option) { root.addSecondaryLanguage(option) }
            }
          }

          Column {
            width: parent.width
            spacing: Style.spacing.xxs

            Repeater {
              model: root.secondaryBibleLanguages

              delegate: Item {
                id: secondaryLanguageRow
                required property var modelData
                width: parent.width
                implicitHeight: Math.max(languageName.implicitHeight, removeLanguageButton.implicitHeight)

                Text {
                  id: languageName
                  anchors.left: parent.left
                  anchors.right: removeLanguageButton.left
                  anchors.rightMargin: Style.spacing.controlGap
                  anchors.verticalCenter: parent.verticalCenter
                  text: root.languageLabel(secondaryLanguageRow.modelData)
                    + " (" + String(secondaryLanguageRow.modelData) + ")"
                  color: root.foreground
                  font.family: Style.font.family
                  font.pixelSize: root.settingsBodyPixelSize
                  elide: Text.ElideRight
                }

                SettingsControlButton {
                  id: removeLanguageButton
                  anchors.right: parent.right
                  anchors.verticalCenter: parent.verticalCenter
                  text: I18n.t(root.appLanguage, "remove")
                  tooltipText: I18n.t(root.appLanguage, "removeLanguage", {
                    language: root.languageLabel(secondaryLanguageRow.modelData)
                  })
                  fontSize: root.settingsBodySmallPixelSize
                  focusable: true
                  foreground: root.muted
                  accent: root.accent
                  onClicked: root.removeSecondaryLanguage(secondaryLanguageRow.modelData)
                }
              }
            }
          }


          }
          Column {
            width: parent.width
            spacing: typography.panelGap
            visible: root.settingsPage === "appearance"


          Item {
            width: parent.width
            implicitHeight: Math.max(appSizeHeader.implicitHeight, appSizePercent.implicitHeight)

            PixelSectionHeader {
              id: appSizeHeader
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter
              text: I18n.t(root.appLanguage, "appSize")
              fontSize: root.settingsSectionPixelSize
              foreground: root.foreground
            }

            Text {
              id: appSizePercent
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              text: Math.round(
                appSizeSlider.dragging
                  ? appSizeSlider.liveValue
                  : root.appScale * 100
              ) + "%"
              color: root.muted
              font.family: Style.font.family
              font.pixelSize: root.settingsCaptionPixelSize
              font.bold: true
            }
          }

          PixelSlider {
            id: appSizeSlider
            width: parent.width
            minimum: 80
            maximum: 160
            step: 5
            integer: true
            tickCount: 9
            value: Math.round(root.appScale * 100)
            trackColor: Style.normalFillFor(root.foreground, root.accent, LightPalette.urgent)
            fillColor: root.accent
            knobColor: root.foreground
            tickColor: LightPalette.popupBackground
            onMoved: function(value) { root.appScalePreviewRequested(value / 100) }
            onReleased: function(value) { root.appScaleCommitRequested(value / 100) }

            MouseArea {
              anchors.fill: parent
              acceptedButtons: Qt.NoButton
              z: 1
              onWheel: function(wheel) { wheel.accepted = root.scrollSettingsByWheel(wheel) }
            }
          }


          }
          Column {
            width: parent.width
            spacing: typography.panelGap
            visible: root.settingsPage === "reading"


          Item {
            width: parent.width
            implicitHeight: Math.max(readerTextHeader.implicitHeight, readerTextPercent.implicitHeight)

            PixelSectionHeader {
              id: readerTextHeader
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter
              text: I18n.t(root.appLanguage, "bibleTextSize")
              fontSize: root.settingsSectionPixelSize
              foreground: root.foreground
            }

            Text {
              id: readerTextPercent
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              text: Math.round(
                readerTextSlider.dragging
                  ? readerTextSlider.liveValue
                  : root.readerTextScale * 100
              ) + "%"
              color: root.muted
              font.family: Style.font.family
              font.pixelSize: root.settingsCaptionPixelSize
              font.bold: true
            }
          }

          PixelSlider {
            id: readerTextSlider
            width: parent.width
            minimum: 70
            maximum: 180
            step: 5
            integer: true
            tickCount: 12
            value: Math.round(root.readerTextScale * 100)
            trackColor: Style.normalFillFor(root.foreground, root.accent, LightPalette.urgent)
            fillColor: root.accent
            knobColor: root.foreground
            tickColor: LightPalette.popupBackground
            onMoved: function(value) { root.readerTextScalePreviewRequested(value / 100) }
            onReleased: function(value) { root.readerTextScaleCommitRequested(value / 100) }

            MouseArea {
              anchors.fill: parent
              acceptedButtons: Qt.NoButton
              z: 1
              onWheel: function(wheel) { wheel.accepted = root.scrollSettingsByWheel(wheel) }
            }
          }


          }
          Column {
            width: parent.width
            spacing: typography.panelGap
            visible: root.settingsPage === "reading"


          PixelSectionHeader {
            width: parent.width
            text: I18n.t(root.appLanguage, "bibleTextStyle")
            fontSize: root.settingsSectionPixelSize
            foreground: root.foreground
          }

          ButtonGroup {
            id: readerFontStyleGroup
            options: [
              {
                value: "youversion",
                label: I18n.t(root.appLanguage, "youVersionStyle"),
                tooltip: I18n.t(root.appLanguage, "youVersionStyleHelp")
              },
              {
                value: "system",
                label: I18n.t(root.appLanguage, "omarchySystem"),
                tooltip: I18n.t(root.appLanguage, "omarchySystemHelp")
              }
            ]
            value: root.readerFontStyle
            foreground: root.foreground
            background: LightPalette.popupBackground
            accent: root.accent
            fontFamily: Style.font.family
            fontSize: root.settingsBodyPixelSize
            onChanged: function(style) {
              root.readerFontStyleCommitRequested(style)
            }
          }

          SettingsToggleRow {
            title: I18n.t(root.appLanguage, "nightMode")
            helpText: I18n.t(root.appLanguage, "nightModeHelp")
            checked: LightPalette.nightMode
            foreground: root.foreground
            muted: root.muted
            accent: root.accent
            bodyFontSize: root.settingsBodyPixelSize
            captionFontSize: root.settingsCaptionPixelSize
            onToggleRequested: function(checked) { root.studyOptionsCommitRequested({ nightMode: checked }) }
          }

          Column {
            width: parent.width
            spacing: typography.labelGap

            Text {
              width: parent.width
              text: I18n.t(root.appLanguage, "textBrightness")
              color: root.foreground
              font.family: Style.font.family
              font.pixelSize: root.settingsBodyPixelSize
            }

            PixelSlider {
              id: textBrightnessSlider
              objectName: "textBrightnessSlider"
              width: parent.width
              minimum: 20
              maximum: 100
              step: 5
              integer: true
              tickCount: 9
              value: Math.round(LightPalette.textBrightness * 100)
              Accessible.role: Accessible.Slider
              Accessible.name: I18n.t(root.appLanguage, "textBrightness")
              Accessible.description: I18n.t(root.appLanguage, "brightnessLow")
                + " – " + I18n.t(root.appLanguage, "brightnessHigh")
              onMoved: function(value) { root.textBrightnessPreviewRequested(value / 100) }
              onReleased: function(value) { root.textBrightnessCommitRequested(value / 100) }

              MouseArea {
                anchors.fill: parent
                acceptedButtons: Qt.NoButton
                z: 1
                onWheel: function(wheel) { wheel.accepted = root.scrollSettingsByWheel(wheel) }
              }
            }

            Item {
              width: parent.width
              height: Math.max(brightnessLowLabel.implicitHeight, brightnessHighLabel.implicitHeight)

              Text {
                id: brightnessLowLabel
                anchors.left: parent.left
                text: I18n.t(root.appLanguage, "brightnessLow")
                color: root.muted
                font.family: Style.font.family
                font.pixelSize: root.settingsCaptionPixelSize
              }

              Text {
                id: brightnessHighLabel
                anchors.right: parent.right
                text: I18n.t(root.appLanguage, "brightnessHigh")
                color: root.muted
                font.family: Style.font.family
                font.pixelSize: root.settingsCaptionPixelSize
              }
            }

            Rectangle {
              width: parent.width
              implicitHeight: brightnessPreview.implicitHeight + typography.panelGap * 2
              color: LightPalette.popupBackground
              border.color: LightPalette.popupBorder
              Text {
                id: brightnessPreview
                objectName: "textBrightnessPreview"
                anchors.fill: parent
                anchors.margins: typography.panelGap
                text: I18n.t(root.appLanguage, "sampleText")
                color: LightPalette.bibleText
                font.family: root.readerFontStyle === "system" ? Style.font.family : "Source Serif 4"
                font.pixelSize: root.settingsBodyPixelSize * root.readerTextScale
                wrapMode: Text.Wrap
                verticalAlignment: Text.AlignVCenter
              }
            }

            Text {
              width: parent.width
              text: I18n.t(root.appLanguage, "textBrightnessHelp")
              color: root.muted
              font.family: Style.font.family
              font.pixelSize: root.settingsCaptionPixelSize
              wrapMode: Text.WordWrap
            }
          }

          SettingsToggleRow {
            objectName: "redLettersSwitch"
            title: I18n.t(root.appLanguage, "redLetters")
            checked: root.redLetters
            foreground: root.foreground
            muted: root.muted
            accent: root.accent
            bodyFontSize: root.settingsBodyPixelSize
            captionFontSize: root.settingsCaptionPixelSize
            controlGap: typography.controlGap
            onToggleRequested: function(checked) {
              root.redLettersCommitRequested(checked)
            }
          }

          SettingsToggleRow {
            objectName: "verseOfTheDaySwitch"
            title: I18n.t(root.appLanguage, "verseOfTheDay")
            helpText: I18n.t(root.appLanguage, "verseOfTheDayHelp")
            checked: root.verseOfTheDayEnabled
            foreground: root.foreground
            muted: root.muted
            accent: root.accent
            bodyFontSize: root.settingsBodyPixelSize
            captionFontSize: root.settingsCaptionPixelSize
            controlGap: typography.controlGap
            onToggleRequested: function(checked) {
              root.verseOfTheDayCommitRequested(checked)
            }
          }

          }
          Column {
            width: parent.width
            spacing: typography.panelGap
            visible: root.settingsPage === "account"


          PixelSectionHeader {
            width: parent.width
            text: I18n.t(root.appLanguage, "account")
            fontSize: root.settingsSectionPixelSize
            foreground: root.foreground
          }

          Item {
            width: parent.width
            implicitHeight: accountRow.implicitHeight

            Row {
              id: accountRow
              width: parent.width
              spacing: Style.spacing.controlGap

              Column {
                width: Math.max(1, parent.width - accountButton.width - avatar.width - parent.spacing * 2)
                spacing: Style.spacing.xxs

                Text {
                  width: parent.width
                  text: root.authenticated
                    ? String((root.accountProfile || {}).name || (root.accountProfile || {}).email || I18n.t(root.appLanguage, "signedIn"))
                    : I18n.t(root.appLanguage, "signInYouVersion")
                  color: root.foreground
                  font.family: Style.font.family
                  font.pixelSize: root.settingsBodyPixelSize
                  font.bold: true
                  elide: Text.ElideRight
                }

                Text {
                  width: parent.width
                  visible: root.authenticated && ((root.accountProfile || {}).email || "") !== ""
                  text: String((root.accountProfile || {}).email || "")
                  color: root.muted
                  font.family: Style.font.family
                  font.pixelSize: root.settingsCaptionPixelSize
                  elide: Text.ElideRight
                }

              }

              Item {
                id: avatar
                width: root.authenticated ? Style.space(32) : 0
                height: width
                visible: root.authenticated
                clip: true

                Rectangle {
                  anchors.fill: parent
                  radius: width / 2
                  color: root.accent
                }
                Image {
                  id: avatarImage
                  anchors.fill: parent
                  source: String((root.accountProfile || {}).avatarUrl || "")
                  fillMode: Image.PreserveAspectCrop
                  asynchronous: true
                  visible: status === Image.Ready
                }
                Text {
                  anchors.centerIn: parent
                  visible: !avatarImage.visible
                  text: root.profileInitials()
                  color: LightPalette.popupBackground
                  font.family: Style.font.family
                  font.pixelSize: root.settingsBodySmallPixelSize
                  font.bold: true
                }
              }

              SettingsControlButton {
                id: accountButton
                objectName: "accountButton"
                enabled: !root.signInStarting
                text: root.authenticated
                  ? I18n.t(root.appLanguage, "signOut")
                  : I18n.t(root.appLanguage, root.signInPending ? "continueSignIn" : "signIn")
                fontSize: root.settingsBodyPixelSize
                focusable: true
                foreground: root.authenticated ? root.muted : root.accent
                accent: root.accent
                onClicked: root.toggleAccount()
              }
            }
          }




          }
          Column {
            width: parent.width
            spacing: typography.panelGap
            visible: root.settingsPage === "languages"


          PixelSectionHeader {
            width: parent.width
            text: I18n.t(root.appLanguage, "offlineVersions")
            fontSize: root.settingsSectionPixelSize
            foreground: root.foreground
          }

          Item {
            width: parent.width
            implicitHeight: selectedDownloadRow.implicitHeight

            Row {
              id: selectedDownloadRow
              width: parent.width
              spacing: Style.spacing.controlGap

              Column {
                width: Math.max(1, parent.width - downloadButton.width - parent.spacing)
                spacing: Style.spacing.xxs
                Text {
                  width: parent.width
                  text: root.selectedVersionLabel
                    || I18n.t(root.appLanguage, "selectedTranslation")
                  color: root.foreground
                  font.family: Style.font.family
                  font.pixelSize: root.settingsBodyPixelSize
                  font.bold: true
                  elide: Text.ElideRight
                }
              }
              SettingsControlButton {
                id: downloadButton
                text: I18n.t(root.appLanguage, "download")
                fontSize: root.settingsBodyPixelSize
                focusable: true
                enabled: root.selectedVersion !== ""
                foreground: root.foreground
                accent: root.accent
                onClicked: root.downloadSelected()
              }
            }
          }

          Text {
            width: parent.width
            visible: root.packages.length === 0
            text: I18n.t(root.appLanguage, "noOfflinePackages")
            color: root.muted
            font.family: Style.font.family
            font.pixelSize: root.settingsBodySmallPixelSize
            wrapMode: Text.WordWrap
          }

          Repeater {
            model: root.packages

            delegate: Column {
              id: packageRow
              required property var modelData
              required property int index
              width: settingsColumn.width
              spacing: Style.spacing.md

              Row {
                width: parent.width
                spacing: Style.spacing.controlGap
                Column {
                  width: Math.max(1, parent.width - packageActions.implicitWidth - parent.spacing)
                  Text {
                    width: parent.width
                    text: root.packageLabel(packageRow.modelData)
                    color: root.foreground
                    font.family: Style.font.family
                    font.pixelSize: root.settingsBodyPixelSize
                    font.bold: true
                    elide: Text.ElideRight
                  }
                  Text {
                    width: parent.width
                    text: root.statusLabel(packageRow.modelData)
                    color: root.muted
                    font.family: Style.font.family
                    font.pixelSize: root.settingsCaptionPixelSize
                  }
                }
                Row {
                  id: packageActions
                  spacing: Style.spacing.xs

                  SettingsControlButton {
                    text: I18n.t(root.appLanguage, "resume")
                    fontSize: root.settingsBodyPixelSize
                    tooltipText: I18n.t(root.appLanguage, "resumeHelp")
                    focusable: true
                    visible: packageRow.modelData.status === "paused"
                    enabled: visible
                    foreground: root.accent
                    accent: root.accent
                    onClicked: root.resumePackage(packageRow.modelData)
                  }

                  SettingsControlButton {
                    id: removeButton
                    text: I18n.t(root.appLanguage, "remove")
                    fontSize: root.settingsBodyPixelSize
                    focusable: true
                    enabled: packageRow.modelData.status !== "downloading"
                    foreground: LightPalette.urgent
                    accent: LightPalette.urgent
                    onClicked: root.removePackage(packageRow.modelData.version)
                  }
                }
              }

              Rectangle {
                width: parent.width
                height: Style.spacing.xs
                visible: packageRow.modelData.status === "downloading"
                radius: 0
                color: Style.normalFillFor(root.foreground, root.accent, LightPalette.urgent)
                Rectangle {
                  width: parent.width * Math.max(0, Math.min(1, Number(packageRow.modelData.progress || 0)))
                  height: parent.height
                  radius: 0
                  color: root.accent
                }
              }

              PanelSeparator {
                width: parent.width
                visible: packageRow.index < root.packages.length - 1
                foreground: root.foreground
              }
            }
          }


          }
          Column {
            width: parent.width
            spacing: typography.panelGap
            visible: root.settingsPage === "appearance"


          PixelSectionHeader {
            width: parent.width
            text: I18n.t(root.appLanguage, "highlightColor")
            fontSize: root.settingsSectionPixelSize
            foreground: root.foreground
          }

          Row {
            width: parent.width
            spacing: Math.max(Style.spacing.xs, Style.spacing.controlGap * 0.75)

            Repeater {
              model: root.colorOptions

              delegate: Rectangle {
                id: colorSwatch
                required property string modelData
                width: Style.space(18)
                height: Style.space(18)
                radius: width / 2
                color: "#" + modelData
                border.width: root.highlightColor.toLowerCase() === modelData.toLowerCase()
                  ? Math.max(2, Style.normalBorderWidth)
                  : 0
                border.color: root.foreground

                Accessible.role: Accessible.Button
                Accessible.name: I18n.t(root.appLanguage, "setHighlightColor", {
                  color: modelData
                })

                MouseArea {
                  anchors.fill: parent
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.setHighlightColor(colorSwatch.modelData)
                }
              }
            }
          }

          Item {
            width: parent.width
            implicitHeight: Math.max(highlightOpacityHeader.implicitHeight, highlightOpacityPercent.implicitHeight)

            PixelSectionHeader {
              id: highlightOpacityHeader
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter
              text: I18n.t(root.appLanguage, "highlightOpacity")
              fontSize: root.settingsSectionPixelSize
              foreground: root.foreground
            }

            Text {
              id: highlightOpacityPercent
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              text: Math.round(
                highlightOpacitySlider.dragging
                  ? highlightOpacitySlider.liveValue
                  : root.highlightOpacity * 100
              ) + "%"
              color: root.muted
              font.family: Style.font.family
              font.pixelSize: root.settingsCaptionPixelSize
              font.bold: true
            }
          }

          PixelSlider {
            id: highlightOpacitySlider
            width: parent.width
            minimum: 20
            maximum: 75
            step: 5
            integer: true
            tickCount: 12
            value: Math.round(root.highlightOpacity * 100)
            trackColor: Style.normalFillFor(root.foreground, root.accent, LightPalette.urgent)
            fillColor: root.accent
            knobColor: root.foreground
            tickColor: LightPalette.popupBackground
            Accessible.role: Accessible.Slider
            Accessible.name: I18n.t(root.appLanguage, "highlightOpacity")
            onMoved: function(value) { root.setHighlightOpacity(value / 100, false) }
            onReleased: function(value) { root.setHighlightOpacity(value / 100, true) }

            MouseArea {
              anchors.fill: parent
              acceptedButtons: Qt.NoButton
              z: 1
              onWheel: function(wheel) { wheel.accepted = root.scrollSettingsByWheel(wheel) }
            }
          }



          }
          Column {
            width: parent.width
            spacing: typography.panelGap
            visible: root.settingsPage === "radio"


          PixelSectionHeader {
            width: parent.width
            text: I18n.t(root.appLanguage, "musicPlayerSection")
            fontSize: root.settingsSectionPixelSize
            foreground: root.foreground
          }

          SettingsToggleRow {
            objectName: "musicPlayerSwitch"
            title: I18n.t(root.appLanguage, "musicPlayer")
            helpText: I18n.t(root.appLanguage, "musicPlayerHelp")
            checked: root.musicPlayerEnabled
            foreground: root.foreground
            muted: root.muted
            accent: root.accent
            bodyFontSize: root.settingsBodyPixelSize
            captionFontSize: root.settingsCaptionPixelSize
            controlGap: typography.controlGap
            onToggleRequested: function(checked) {
              root.musicPlayerCommitRequested(checked)
            }
          }

          Column {
            width: parent.width
            visible: root.musicPlayerEnabled
            spacing: typography.labelGap

            Text {
              width: parent.width
              text: I18n.t(root.appLanguage, "radioSkin")
              color: root.foreground
              font.family: Style.font.family
              font.pixelSize: root.settingsBodyPixelSize
              font.bold: true
            }

            Text {
              width: parent.width
              text: I18n.t(root.appLanguage, "radioSkinHelp")
              color: root.muted
              font.family: Style.font.family
              font.pixelSize: root.settingsCaptionPixelSize
              wrapMode: Text.WordWrap
            }

            Row {
              id: radioSkinSelector
              objectName: "radioSkinSelector"
              property string value: String(root.radioSkin)
              property int focusedIndex: -1
              readonly property var displayedOrder: RadioSkins.normalizeOrder(root.radioSkinOrder)
              signal changed(string value)
              height: Style.spacing.controlHeight
              spacing: Style.spacing.md
              activeFocusOnTab: true

              onChanged: function(value) { root.radioSkinCommitRequested(Number(value)) }
              onActiveFocusChanged: {
                focusedIndex = activeFocus ? Math.max(0, displayedOrder.indexOf(Number(value))) : -1
              }

              Keys.priority: Keys.BeforeItem
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Left || event.key === Qt.Key_H
                    || event.text === "h") {
                  focusedIndex = Math.max(0, focusedIndex - 1)
                  event.accepted = true
                } else if (event.key === Qt.Key_Right || event.key === Qt.Key_L
                           || event.text === "l") {
                  focusedIndex = Math.min(6, focusedIndex + 1)
                  event.accepted = true
                } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter
                           || event.key === Qt.Key_Space) {
                  if (focusedIndex >= 0) changed(String(displayedOrder[focusedIndex]))
                  event.accepted = true
                }
              }

              Repeater {
                model: radioSkinSelector.displayedOrder
                delegate: PixelButton {
                  required property int index
                  required property var modelData
                  readonly property int skinNumber: Number(modelData)
                  objectName: "radioSkinChoice-" + skinNumber
                  width: Style.spacing.controlHeight
                  height: Style.spacing.controlHeight
                  text: String(skinNumber)
                  tooltipText: skinNumber + " · " + RadioSkins.spec(skinNumber).name
                  selected: radioSkinSelector.value === String(skinNumber)
                  hasCursor: radioSkinSelector.activeFocus
                    && radioSkinSelector.focusedIndex === index
                  bordered: true
                  foreground: root.foreground
                  background: LightPalette.popupBackground
                  accent: root.accent
                  fontFamily: Style.font.family
                  fontSize: root.settingsBodySmallPixelSize
                  onClicked: radioSkinSelector.changed(String(skinNumber))
                }
              }
            }
          }

          Column {
            id: customStationsEditor
            objectName: "customStationsEditor"
            width: parent.width
            visible: root.musicPlayerEnabled
            spacing: typography.labelGap

            Text {
              width: parent.width
              text: I18n.t(root.appLanguage, "radioStationList")
              color: root.foreground
              font.family: Style.font.family
              font.pixelSize: root.settingsBodyPixelSize
              font.bold: true
            }

            Text {
              width: parent.width
              text: I18n.t(root.appLanguage, "radioStationListHelp")
              color: root.muted
              font.family: Style.font.family
              font.pixelSize: root.settingsCaptionPixelSize
              wrapMode: Text.WordWrap
            }

            Item {
              width: parent.width
              implicitHeight: Style.spacing.controlHeight

              BorderSurface {
                anchors.fill: parent
                color: LightPalette.popupBackground
                borderSpec: Border.localOrSurfaceSpec(
                  "popups", "border", LightPalette.popupBorder, LightPalette.popupBorder,
                  Style.normalBorderWidth
                )
                radius: 0
              }

              TextInput {
                id: customStationNameInput
                objectName: "customStationNameInput"
                anchors.fill: parent
                anchors.leftMargin: Style.spacing.controlPaddingX
                anchors.rightMargin: Style.spacing.controlPaddingX
                color: root.foreground
                selectionColor: Style.selectionFillFor(root.foreground, root.accent, LightPalette.urgent)
                selectedTextColor: root.foreground
                font.family: Style.font.family
                font.pixelSize: root.settingsBodyPixelSize
                verticalAlignment: TextInput.AlignVCenter
                selectByMouse: true
                clip: true
                activeFocusOnTab: true
                maximumLength: 80

                Text {
                  anchors.fill: parent
                  verticalAlignment: Text.AlignVCenter
                  visible: customStationNameInput.text === ""
                    && !customStationNameInput.activeFocus
                  text: I18n.t(root.appLanguage, "radioStationName")
                  color: root.muted
                  font: customStationNameInput.font
                }

                Keys.onReturnPressed: customStationDescriptionInput.forceActiveFocus()
                Keys.onEnterPressed: customStationDescriptionInput.forceActiveFocus()
              }
            }

            Item {
              width: parent.width
              implicitHeight: Style.spacing.controlHeight

              BorderSurface {
                anchors.fill: parent
                color: LightPalette.popupBackground
                borderSpec: Border.localOrSurfaceSpec(
                  "popups", "border", LightPalette.popupBorder, LightPalette.popupBorder,
                  Style.normalBorderWidth
                )
                radius: 0
              }

              TextInput {
                id: customStationDescriptionInput
                objectName: "customStationDescriptionInput"
                anchors.fill: parent
                anchors.leftMargin: Style.spacing.controlPaddingX
                anchors.rightMargin: Style.spacing.controlPaddingX
                color: root.foreground
                selectionColor: Style.selectionFillFor(root.foreground, root.accent, LightPalette.urgent)
                selectedTextColor: root.foreground
                font.family: Style.font.family
                font.pixelSize: root.settingsBodySmallPixelSize
                verticalAlignment: TextInput.AlignVCenter
                selectByMouse: true
                clip: true
                activeFocusOnTab: true
                maximumLength: 160

                Text {
                  anchors.fill: parent
                  verticalAlignment: Text.AlignVCenter
                  visible: customStationDescriptionInput.text === ""
                    && !customStationDescriptionInput.activeFocus
                  text: I18n.t(root.appLanguage, "radioStationDescription")
                  color: root.muted
                  font: customStationDescriptionInput.font
                }

                Keys.onReturnPressed: customStationUrlInput.forceActiveFocus()
                Keys.onEnterPressed: customStationUrlInput.forceActiveFocus()
              }
            }

            Row {
              width: parent.width
              spacing: typography.controlGap

              Item {
                width: Math.max(1, parent.width - addCustomStationButton.width - parent.spacing)
                height: Style.spacing.controlHeight

                BorderSurface {
                  anchors.fill: parent
                  color: LightPalette.popupBackground
                  borderSpec: Border.localOrSurfaceSpec(
                    "popups", "border", LightPalette.popupBorder, LightPalette.popupBorder,
                    Style.normalBorderWidth
                  )
                  radius: 0
                }

                TextInput {
                  id: customStationUrlInput
                  objectName: "customStationUrlInput"
                  anchors.fill: parent
                  anchors.leftMargin: Style.spacing.controlPaddingX
                  anchors.rightMargin: Style.spacing.controlPaddingX
                  color: root.foreground
                  selectionColor: Style.selectionFillFor(root.foreground, root.accent, LightPalette.urgent)
                  selectedTextColor: root.foreground
                  font.family: Style.font.family
                  font.pixelSize: root.settingsBodySmallPixelSize
                  verticalAlignment: TextInput.AlignVCenter
                  selectByMouse: true
                  clip: true
                  activeFocusOnTab: true
                  maximumLength: 512

                  Text {
                    anchors.fill: parent
                    verticalAlignment: Text.AlignVCenter
                    visible: customStationUrlInput.text === ""
                      && !customStationUrlInput.activeFocus
                    text: I18n.t(root.appLanguage, "radioStreamUrl")
                    color: root.muted
                    font: customStationUrlInput.font
                  }

                  Keys.onReturnPressed: root.addCustomRadioStation()
                  Keys.onEnterPressed: root.addCustomRadioStation()
                }
              }

              SettingsControlButton {
                id: addCustomStationButton
                objectName: "addCustomStationButton"
                anchors.verticalCenter: parent.verticalCenter
                text: I18n.t(root.appLanguage, root.editingStationUrl !== "" ? "saveStation" : "add")
                enabled: !root.customRadioStationSavePending
                fontSize: root.settingsBodySmallPixelSize
                focusable: true
                foreground: root.accent
                accent: root.accent
                tooltipText: I18n.t(root.appLanguage, "addRadioStation")
                onClicked: root.addCustomRadioStation()
              }
            }

            SettingsControlButton {
              visible: root.editingStationUrl !== ""
              text: I18n.t(root.appLanguage, "cancel")
              focusable: true
              enabled: !root.customRadioStationSavePending
              onClicked: root.cancelRadioEdit()
            }
            LightTextField {
              width: parent.width
              height: Style.spacing.controlHeight
              placeholderText: I18n.t(root.appLanguage, "searchStations")
              fontSize: root.settingsBodySmallPixelSize
              onTextChanged: root.stationSearch = text
            }
            BackupControls {
              width: parent.width
              radioOnly: true
              api: root.api
              appLanguage: root.appLanguage
              onRestored: root.backupRestored()
            }
            Text {
              width: parent.width
              visible: root.managedRadioStations.length === 0
              text: I18n.t(root.appLanguage, "noRadioStations")
              color: root.muted
              font.family: Style.font.family
              font.pixelSize: root.settingsCaptionPixelSize
              wrapMode: Text.WordWrap
            }

            Item {
              id: settingsStationViewport
              width: parent.width
              implicitHeight: Math.min(
                settingsStationList.contentHeight,
                Math.max(Style.space(240), root.settingsBodyPixelSize * 16)
              )
              height: implicitHeight

              ListView {
                id: settingsStationList
                objectName: "settingsRadioStationList"
                anchors.fill: parent
                clip: true
                model: root.filteredRadioStations
                spacing: typography.labelGap
                boundsBehavior: Flickable.StopAtBounds
                reuseItems: true

                delegate: Item {
                id: customStationRow
                required property var modelData
                required property int index
                readonly property int sourceIndex: root.stationIndexIn(root.managedRadioStations, modelData)
                objectName: "settingsRadioStation-" + index
                width: settingsStationList.width - (settingsStationScrollBar.visible
                  ? settingsStationScrollBar.width
                  : 0)
                implicitHeight: Math.max(customStationCopy.implicitHeight, stationActions.implicitHeight)

                DropArea {
                  id: topSettingsStationDrop
                  anchors.left: parent.left; anchors.right: parent.right
                  anchors.top: parent.top; height: parent.height / 2
                  keys: ["light-radio-station"]
                  z: 20
                  onDropped: function(drop) {
                    root.reorderRadioStation(root.draggedRadioStationIndex, customStationRow.sourceIndex)
                    drop.acceptProposedAction()
                  }
                }

                DropArea {
                  id: bottomSettingsStationDrop
                  anchors.left: parent.left; anchors.right: parent.right
                  anchors.bottom: parent.bottom; height: parent.height / 2
                  keys: ["light-radio-station"]
                  z: 20
                  onDropped: function(drop) {
                    root.reorderRadioStation(root.draggedRadioStationIndex, customStationRow.sourceIndex + 1)
                    drop.acceptProposedAction()
                  }
                }

                Rectangle {
                  anchors.left: parent.left; anchors.right: parent.right
                  anchors.top: topSettingsStationDrop.containsDrag ? parent.top : undefined
                  anchors.bottom: bottomSettingsStationDrop.containsDrag ? parent.bottom : undefined
                  height: Math.max(1, Style.normalBorderWidth)
                  visible: topSettingsStationDrop.containsDrag || bottomSettingsStationDrop.containsDrag
                  color: root.accent
                  z: 30
                }

                Item {
                  id: settingsStationDragSurface
                  anchors.left: parent.left
                  anchors.right: stationActions.left
                  anchors.rightMargin: typography.controlGap
                  height: parent.height
                  z: settingsStationDragArea.drag.active ? 10 : 1
                  opacity: settingsStationDragArea.drag.active ? 0.82 : 1
                  Drag.active: settingsStationDragArea.drag.active
                  Drag.source: customStationRow
                  Drag.keys: ["light-radio-station"]
                  Drag.supportedActions: Qt.MoveAction
                  Drag.hotSpot.x: width / 2
                  Drag.hotSpot.y: height / 2

                  Column {
                    id: customStationCopy
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.spacing.xxs

                    Text {
                      width: parent.width
                      text: String(customStationRow.modelData.name || "")
                      color: root.foreground
                      font.family: Style.font.family
                      font.pixelSize: root.settingsBodySmallPixelSize
                      font.bold: true
                      elide: Text.ElideRight
                    }

                    Text {
                      width: parent.width
                      text: String(customStationRow.modelData.streamUrl || "")
                      color: root.muted
                      font.family: Style.font.family
                      font.pixelSize: root.settingsCaptionPixelSize
                      elide: Text.ElideMiddle
                    }
                  }

                  MouseArea {
                    id: settingsStationDragArea
                    anchors.fill: parent
                    hoverEnabled: true
                    preventStealing: true
                    cursorShape: drag.active ? Qt.ClosedHandCursor : Qt.OpenHandCursor
                    drag.target: settingsStationDragSurface
                    drag.axis: Drag.YAxis
                    onPressed: root.draggedRadioStationIndex = customStationRow.sourceIndex
                    onPositionChanged: function(mouse) {
                      if (!drag.active) return
                      var point = mapToItem(settingsStationList, mouse.x, mouse.y)
                      if (point.y < 24)
                        settingsStationList.contentY = Math.max(
                          settingsStationList.originY,
                          settingsStationList.contentY - 12
                        )
                      else if (point.y > settingsStationList.height - 24)
                        settingsStationList.contentY = Math.min(
                          settingsStationList.originY + Math.max(
                            0,
                            settingsStationList.contentHeight - settingsStationList.height
                          ),
                          settingsStationList.contentY + 12
                        )
                    }
                    onReleased: function(mouse) {
                      if (drag.active) {
                        var point = mapToItem(settingsStationList, mouse.x, mouse.y)
                        var contentY = point.y + settingsStationList.contentY
                        var targetIndex = settingsStationList.indexAt(point.x, contentY)
                        if (targetIndex >= 0) {
                          var targetItem = settingsStationList.itemAtIndex(targetIndex)
                          var sourceIndex = root.stationIndexIn(root.managedRadioStations, root.filteredRadioStations[targetIndex])
                          var after = targetItem && contentY > targetItem.y + targetItem.height / 2
                          root.reorderRadioStation(root.draggedRadioStationIndex, sourceIndex + (after ? 1 : 0))
                        } else if (root.stationSearch.trim() === "") {
                          root.reorderRadioStation(root.draggedRadioStationIndex, point.y < 0 ? 0 : root.managedRadioStations.length)
                        }
                      }
                      settingsStationDragSurface.y = 0
                      root.draggedRadioStationIndex = -1
                    }
                    onCanceled: {
                      settingsStationDragSurface.y = 0
                      root.draggedRadioStationIndex = -1
                    }
                  }
                }

                Column {
                  id: stationActions
                  anchors.right: parent.right
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: typography.labelGap
                  z: 40
                  Row {
                    spacing: typography.labelGap
                    SettingsControlButton {
                      text: root.favoriteStations.indexOf(root.stationKey(customStationRow.modelData)) >= 0 ? "★" : "☆"
                      tooltipText: I18n.t(root.appLanguage, "favoriteStation")
                      focusable: true
                      onClicked: root.toggleFavorite(customStationRow.modelData)
                    }
                    SettingsControlButton {
                      text: I18n.t(root.appLanguage, "edit")
                      visible: customStationRow.modelData.custom === true
                      enabled: !root.customRadioStationSavePending
                      focusable: true
                      onClicked: root.editRadioStation(customStationRow.modelData)
                    }
                SettingsControlButton {
                  id: removeCustomStationButton
                  enabled: !root.customRadioStationSavePending
                  objectName: "removeRadioStation-" + customStationRow.index
                  z: 40
                  text: I18n.t(root.appLanguage, "remove")
                  fontSize: root.settingsBodySmallPixelSize
                  focusable: true
                  foreground: root.muted
                  accent: root.accent
                  tooltipText: I18n.t(root.appLanguage, "removeRadioStation", {
                    station: String(customStationRow.modelData.name || "")
                  })
                  onClicked: root.removeRadioStation(customStationRow.modelData)
                }
                  }
                  Row {
                    spacing: typography.labelGap
                    SettingsControlButton {
                      text: "↑"
                      tooltipText: I18n.t(root.appLanguage, "moveUp")
                      enabled: customStationRow.sourceIndex > 0
                      focusable: true
                      onClicked: root.reorderRadioStation(customStationRow.sourceIndex, customStationRow.sourceIndex - 1)
                    }
                    SettingsControlButton {
                      text: "↓"
                      tooltipText: I18n.t(root.appLanguage, "moveDown")
                      enabled: customStationRow.sourceIndex < root.managedRadioStations.length - 1
                      focusable: true
                      onClicked: root.reorderRadioStation(customStationRow.sourceIndex, customStationRow.sourceIndex + 2)
                    }
                  }
                }
                }
              }

              TransientScrollBar {
                id: settingsStationScrollBar
                objectName: "settingsStationScrollbar"
                anchors.top: settingsStationList.top
                anchors.right: settingsStationList.right
                anchors.bottom: settingsStationList.bottom
                flickable: settingsStationList
                foreground: root.muted
              }
            }

            Item {
              width: parent.width
              height: restoreDefaultStationsButton.visible
                ? restoreDefaultStationsButton.implicitHeight
                : 0

              SettingsControlButton {
                id: restoreDefaultStationsButton
                objectName: "restoreDefaultStationsButton"
                anchors.right: parent.right
                visible: root.hiddenRadioStationIds.length > 0
                text: I18n.t(root.appLanguage, "restoreDefaultStations")
                fontSize: root.settingsBodySmallPixelSize
                focusable: true
                foreground: root.accent
                accent: root.accent
                tooltipText: I18n.t(root.appLanguage, "restoreDefaultStationsHelp")
                onClicked: root.restoreDefaultRadioStations()
              }
            }
          }
          }

        }
      }
    }
  }

  Component {
    id: shortcutRowDelegate

    Item {
      id: shortcutRow
      required property var modelData
      width: parent ? parent.width : 0
      implicitHeight: Math.max(shortcutKeys.height, shortcutDescription.implicitHeight)

      BorderSurface {
        id: shortcutKeys
        objectName: "shortcut-" + String(shortcutRow.modelData.id || shortcutRow.modelData.keys)
        width: Math.min(parent.width * 0.38, Style.space(190))
        height: Style.spacing.controlHeight
        color: capturing
          ? Util.alpha(LightPalette.urgent, 0.16)
          : (editable ? LightPalette.popupBackground : Util.alpha(LightPalette.muted, 0.14))
        radius: 0
        borderSpec: Border.localOrSurfaceSpec(
          "popups", "border",
          capturing ? LightPalette.urgent : (editable ? LightPalette.popupBorder : LightPalette.muted),
          capturing ? LightPalette.urgent : (editable ? LightPalette.popupBorder : LightPalette.muted),
          capturing ? Math.max(Style.normalBorderWidth, 2) : Style.normalBorderWidth
        )

        readonly property bool editable: shortcutRow.modelData.editable === true
        readonly property bool capturing: editable
          && root.capturingKeybinding !== ""
          && root.capturingKeybinding === String(shortcutRow.modelData.id || "")
        focus: capturing

        Rectangle {
          id: captureOutline
          anchors.fill: parent
          anchors.margins: -Math.max(1, Style.normalBorderWidth)
          radius: 0
          color: "transparent"
          border.width: Math.max(1, Style.normalBorderWidth)
          border.color: LightPalette.urgent
          visible: shortcutKeys.capturing

          SequentialAnimation on opacity {
            running: captureOutline.visible
            loops: Animation.Infinite
            NumberAnimation { to: 0.28; duration: 440 }
            NumberAnimation { to: 1; duration: 440 }
          }
        }

        Keys.priority: Keys.BeforeItem
        Keys.onShortcutOverride: function(event) {
          if (shortcutKeys.capturing) event.accepted = true
        }
        Keys.onPressed: function(event) {
          if (!shortcutKeys.capturing) return
          if (event.isAutoRepeat) { event.accepted = true; return }
          root.captureModifierPreview = root.shortcutModifiers(event,
            shortcutRow.modelData.id === "globalToggle" || shortcutRow.modelData.id === "verseOfTheDay",
            false).join("+")
          if (event.key === Qt.Key_Escape && event.modifiers === Qt.NoModifier
              && shortcutRow.modelData.id !== "closeCurrentPage") {
            root.cancelKeybindingCapture()
            event.accepted = true
            return
          }
          if ((event.key === Qt.Key_Return || event.key === Qt.Key_Enter)
              && event.modifiers === Qt.NoModifier && root.pendingKeybinding !== "") {
            root.commitKeybindingCapture()
            event.accepted = true
            return
          }
          var shortcut = root.shortcutFromEvent(
            event,
            shortcutRow.modelData.id === "globalToggle"
              || shortcutRow.modelData.id === "verseOfTheDay",
            true
          )
          if (shortcut !== "") root.stageKeybinding(shortcut)
          event.accepted = true
        }
        Keys.onReleased: function(event) {
          if (!shortcutKeys.capturing) return
          root.captureModifierPreview = root.shortcutModifiers(event,
            shortcutRow.modelData.id === "globalToggle" || shortcutRow.modelData.id === "verseOfTheDay",
            true).join("+")
          event.accepted = true
        }

        Text {
          id: shortcutText
          anchors.fill: parent
          anchors.leftMargin: Style.spacing.controlPaddingX
          anchors.rightMargin: Style.spacing.controlPaddingX
          verticalAlignment: Text.AlignVCenter
          visible: !shortcutKeys.capturing
          text: String(shortcutRow.modelData.keys || "")
          color: shortcutKeys.editable ? root.accent : root.muted
          font.family: Style.font.family
          font.pixelSize: root.settingsBodySmallPixelSize
          font.bold: true
          elide: Text.ElideRight
        }

        TextInput {
          id: shortcutCaptureInput
          objectName: "shortcut-capture-input-" + String(shortcutRow.modelData.id || "")
          anchors.fill: parent
          anchors.leftMargin: Style.spacing.controlPaddingX
          anchors.rightMargin: Style.spacing.controlPaddingX
          visible: shortcutKeys.capturing
          text: root.pendingKeybinding || root.captureModifierPreview
          readOnly: true
          selectByMouse: true
          cursorVisible: false
          clip: true
          horizontalAlignment: TextInput.AlignHCenter
          verticalAlignment: TextInput.AlignVCenter
          color: LightPalette.urgent
          font.family: Style.font.family
          font.pixelSize: root.settingsBodySmallPixelSize
          font.bold: true
          Accessible.role: Accessible.EditableText
          Accessible.name: I18n.t(root.appLanguage, "shortcutEditing", {
            action: String(shortcutRow.modelData.description || "")
          })
        }

        Text {
          anchors.fill: parent
          anchors.leftMargin: Style.spacing.controlPaddingX
          anchors.rightMargin: Style.spacing.controlPaddingX
          visible: shortcutKeys.capturing && root.pendingKeybinding === "" && root.captureModifierPreview === ""
          verticalAlignment: Text.AlignVCenter
          horizontalAlignment: Text.AlignHCenter
          text: I18n.t(root.appLanguage, "shortcutCapture")
          color: LightPalette.urgent
          font.family: Style.font.family
          font.pixelSize: root.settingsBodySmallPixelSize
          font.bold: true
          elide: Text.ElideRight
        }

        MouseArea {
          anchors.fill: parent
          enabled: shortcutKeys.editable
          cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
          onDoubleClicked: {
            root.beginKeybindingCapture(shortcutRow.modelData.id)
            shortcutKeys.forceActiveFocus()
          }
        }
      }

      Text {
        id: shortcutDescription
        anchors.left: shortcutKeys.right
        anchors.leftMargin: Style.spacing.controlGap
        anchors.right: parent.right
        text: shortcutKeys.capturing
          ? I18n.t(root.appLanguage, "shortcutEditing", {
            action: String(parent.modelData.description || "")
          })
          : String(parent.modelData.description || "")
        color: shortcutKeys.capturing
          ? LightPalette.urgent
          : (shortcutKeys.editable ? root.foreground : root.muted)
        font.family: Style.font.family
        font.pixelSize: root.settingsBodySmallPixelSize
        wrapMode: Text.WordWrap
      }
    }
  }
}
