pragma ComponentBehavior: Bound
import QtQuick
import qs.Commons
import qs.Ui
import "components"
import "components/I18n.js" as I18n
import "components/PreferenceUtils.js" as PreferenceUtils
import "components/RadioStations.js" as RadioStations
import "components/ShortcutUtils.js" as ShortcutUtils
import "components/RadioSkins.js" as RadioSkins

Panel {
  id: root
  moduleName: "light.bible-reader"
  // The shell routes IPC through the owning BarWidget, so this panel does not
  // register another target of its own.
  ipcTarget: ""
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property real appScale: 1.2
  property real readerTextScale: 1
  property string readerFontStyle: "youversion"
  property bool redLetters: false
  property bool accountAuthenticated: false
  readonly property string activeBibleVersion: applicationView.selectedVersion
  onActiveBibleVersionChanged: preloadVerseOfTheDay()
  onAccountAuthenticatedChanged: {
    if (accountAuthenticated) {
      api.get("/v1/user-data/preferences/reader-tabs", "panel.reader-tabs")
      preloadVerseOfTheDay()
    } else {
      readerTabs = ({ tabs: [], activeTabIndex: -1 })
      readerTabsLoaded = false
      verseOfTheDayOpened = false
      verseOfTheDayLoading = false
      verseOfTheDayPassage = ({})
      verseOfTheDayLoadedVersion = ""
      dailyVerseTimer.stop()
      radioOpened = false
    }
  }
  property bool verseOfTheDayEnabled: false
  property bool musicPlayerEnabled: false
  property var customRadioStations: []
  property var hiddenRadioStationIds: []
  property var radioStationOrder: []
  property var settingsSectionOrder: [
    "reading", "appearance", "radio", "languages", "account", "shortcuts", "backup"
  ]
  // Radio preferences are optimistic, but always retain the last service-
  // confirmed value so a rejected or interrupted save cannot strand the UI.
  property bool confirmedMusicPlayerEnabled: false
  property var confirmedCustomRadioStations: []
  property var confirmedHiddenRadioStationIds: []
  property var confirmedRadioStationOrder: []
  property var confirmedSettingsSectionOrder: [
    "reading", "appearance", "radio", "languages", "account", "shortcuts", "backup"
  ]
  property int musicPlayerRevision: 0
  property int customRadioStationsRevision: 0
  property int hiddenRadioStationIdsRevision: 0
  property int radioStationOrderRevision: 0
  property int settingsSectionOrderRevision: 0
  property bool verseOfTheDayOpened: false
  property bool radioOpened: false
  property bool radioPlayerLoaded: false
  property real previewTextBrightness: -1
  readonly property real textBrightness: previewTextBrightness >= 0 ? previewTextBrightness
    : Math.max(0.2, Math.min(1, Number(studyOptions.textBrightness === undefined ? 1 : studyOptions.textBrightness)))
  Binding {
    target: LightPalette
    property: "textBrightness"
    value: root.textBrightness
  }

  function previewBrightness(value) {
    previewTextBrightness = Math.max(0.2, Math.min(1, Math.round(value * 100) / 100))
    textBrightnessSaveTimer.restart()
  }

  function saveBrightness(value) {
    textBrightnessSaveTimer.stop()
    persistStudyOptions({ textBrightness: Math.max(0.2, Math.min(1, Math.round(value * 100) / 100)) })
    previewTextBrightness = -1
  }

  Timer {
    id: textBrightnessSaveTimer
    interval: 250
    onTriggered: root.saveBrightness(root.textBrightness)
  }
  property int studyOptionsRevision: 0
  property var confirmedStudyOptions: ({ resumeReading: true, favoriteStations: [], radioSkin: 1 })
  property bool restoringBackup: false
  property var studyOptions: ({ resumeReading: true, favoriteStations: [], radioSkin: 1 })
  property string requestedSettingsPage: "reading"
  property bool settingsLoaded: false
  property bool settingsOpenPending: false
  property bool focusRadioStationAddPending: false
  property bool verseOfTheDayLoading: false
  property var verseOfTheDayPassage: ({})
  property string verseOfTheDayError: ""
  property int verseOfTheDayLoadedDay: -1
  property string verseOfTheDayLoadedVersion: ""
  property string verseOfTheDayRequestedVersion: ""
  property string verseOfTheDayLoadedDate: ""
  property string verseOfTheDayRequestedDate: ""
  property int verseOfTheDayFailures: 0
  readonly property string systemLocale: Qt.locale().name
  readonly property string appLanguage: I18n.interfaceLanguage(systemLocale)
  property var secondaryBibleLanguages: []
  property var readerTabs: ({ tabs: [], activeTabIndex: -1 })
  property bool readerTabsLoaded: false
  property var keybindings: ({
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
  property real brightnessWheelAccumulator: 0
  property real appWheelAccumulator: 0
  Binding {
    target: LightPalette
    property: "nightMode"
    value: root.studyOptions.nightMode === true
  }
  property real readerWheelAccumulator: 0

  readonly property var settingsModal: settingsLoader.item
  readonly property var radioPlayer: radioLoader.item
  readonly property var verseOfTheDayPopup: verseLoader.item
  readonly property bool settingsOpened: settingsModal
    ? settingsModal.opened === true
    : false
  readonly property bool shortcutCaptureIdle: !settingsModal
    || settingsModal.capturingKeybinding === ""

  readonly property var barIdentity: hostWidget || root
  readonly property string serviceBaseUrl: String(
    setting("serviceBaseUrl", LightSession.backend ? LightSession.backend.baseUrl : "http://127.0.0.1:8788")
  )

  function normalizedAppScale(value) {
    return PreferenceUtils.appScale(value)
  }

  function previewAppScale(value) {
    appScale = normalizedAppScale(value)
    appScaleSaveTimer.restart()
  }

  function persistAppScale(value) {
    appScale = normalizedAppScale(value)
    appScaleSaveTimer.stop()
    api.put(
      "/v1/user-data/preferences/app-scale",
      { scale: appScale },
      "panel.app-scale-save"
    )
  }

  function adjustAppScale(delta) {
    previewAppScale(appScale + delta)
  }

  function normalizedReaderTextScale(value) {
    return PreferenceUtils.readerTextScale(value)
  }

  function previewReaderTextScale(value) {
    readerTextScale = normalizedReaderTextScale(value)
    readerTextScaleSaveTimer.restart()
  }

  function persistReaderTextScale(value) {
    readerTextScale = normalizedReaderTextScale(value)
    readerTextScaleSaveTimer.stop()
    api.put(
      "/v1/user-data/preferences/reader-text-scale",
      { scale: readerTextScale },
      "panel.reader-text-scale-save"
    )
  }

  function adjustReaderTextScale(delta) {
    persistReaderTextScale(readerTextScale + delta)
  }

  function normalizedReaderFontStyle(value) {
    return PreferenceUtils.readerFontStyle(value)
  }

  function previewReaderFontStyle(value) {
    readerFontStyle = normalizedReaderFontStyle(value)
  }

  function persistReaderFontStyle(value) {
    readerFontStyle = normalizedReaderFontStyle(value)
    api.put(
      "/v1/user-data/preferences/reader-font-style",
      { style: readerFontStyle },
      "panel.reader-font-style-save"
    )
  }

  function toggleReaderFontStyle() {
    persistReaderFontStyle(readerFontStyle === "system" ? "youversion" : "system")
  }

  function persistRedLetters(value) {
    redLetters = value === true
    api.put(
      "/v1/user-data/preferences/red-letters",
      { enabled: redLetters },
      "panel.red-letters-save"
    )
  }

  function persistVerseOfTheDayEnabled(value) {
    verseOfTheDayEnabled = value === true
    api.put(
      "/v1/user-data/preferences/verse-of-the-day",
      { enabled: verseOfTheDayEnabled },
      "panel.verse-of-the-day-save"
    )
  }

  function saveRevision(tag, prefix) {
    return PreferenceUtils.saveRevision(tag, prefix)
  }

  function persistMusicPlayerEnabled(value) {
    musicPlayerRevision += 1
    musicPlayerEnabled = value === true
    if (!musicPlayerEnabled) radioOpened = false
    api.put(
      "/v1/user-data/preferences/music-player",
      { enabled: musicPlayerEnabled },
      "settings.music-player-save:" + musicPlayerRevision
    )
  }

  function normalizedCustomRadioStations(value) {
    return PreferenceUtils.customRadioStations(
      value,
      I18n.t(appLanguage, "customRadioStation")
    )
  }

  function persistCustomRadioStations(value, operation) {
    customRadioStationsRevision += 1
    customRadioStations = normalizedCustomRadioStations(value)
    api.put(
      "/v1/user-data/preferences/custom-radio-stations",
      { stations: customRadioStations },
      "settings.custom-radio-stations-save:" + customRadioStationsRevision
        + ":" + String(operation || "update")
    )
  }

  function normalizedHiddenRadioStationIds(value) {
    return PreferenceUtils.hiddenRadioStationIds(value)
  }

  function persistHiddenRadioStationIds(value, operation) {
    hiddenRadioStationIdsRevision += 1
    hiddenRadioStationIds = normalizedHiddenRadioStationIds(value)
    api.put(
      "/v1/user-data/preferences/hidden-radio-stations",
      { stationIds: hiddenRadioStationIds },
      "settings.hidden-radio-stations-save:" + hiddenRadioStationIdsRevision
        + ":" + String(operation || "update")
    )
  }

  function normalizedRadioStationOrder(value) {
    return PreferenceUtils.radioStationOrder(value)
  }

  function persistRadioStationOrder(value) {
    radioStationOrderRevision += 1
    radioStationOrder = normalizedRadioStationOrder(value)
    api.put(
      "/v1/user-data/preferences/radio-station-order",
      { stationKeys: radioStationOrder },
      "settings.radio-station-order-save:" + radioStationOrderRevision
    )
  }

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

  function persistSettingsSectionOrder(value) {
    settingsSectionOrderRevision += 1
    settingsSectionOrder = normalizedSettingsSectionOrder(value)
    api.put(
      "/v1/user-data/preferences/settings-section-order",
      { sectionIds: settingsSectionOrder },
      "settings.section-order-save:" + settingsSectionOrderRevision
    )
  }

  function openVerseOfTheDay() {
    settingsOpenPending = false
    if (!accountAuthenticated || !verseOfTheDayEnabled || verseOfTheDayVersion() === "") return
    if (!root.opened) root.open()
    if (settingsModal) settingsModal.close()
    radioOpened = false
    verseOfTheDayOpened = true
    preloadVerseOfTheDay()
  }

  function openRadio() {
    settingsOpenPending = false
    if (!musicPlayerEnabled) return
    if (!root.opened) root.open()
    if (settingsModal) settingsModal.close()
    applicationView.closeStudy()
    verseOfTheDayOpened = false
    radioPlayerLoaded = true
    radioOpened = true
    Qt.callLater(function() {
      if (root.radioOpened && radioPlayer) radioPlayer.focusTarget.forceActiveFocus()
    })
  }

  function closeRadio() {
    radioOpened = false
    if (root.opened && applicationView.inputItem)
      Qt.callLater(function() { applicationView.inputItem.forceActiveFocus() })
  }

  function deleteRadioStation(station) {
    if (!station) return
    if (station.custom === true) {
      var removedUrl = String(station.streamUrl || "")
      var nextCustom = customRadioStations.filter(function(item) {
        return String(item.streamUrl || "") !== removedUrl
      })
      if (nextCustom.length !== customRadioStations.length)
        persistCustomRadioStations(nextCustom, "remove")
    } else {
      var stationId = String(station.id || "")
      if (stationId && hiddenRadioStationIds.indexOf(stationId) < 0)
        persistHiddenRadioStationIds(hiddenRadioStationIds.concat([stationId]), "remove")
    }
  }

  function finishOpeningSettings() {
    if (!settingsModal || !settingsOpenPending) return
    settingsOpenPending = false
    settingsModal.settingsPage = requestedSettingsPage
    settingsModal.open()
    if (focusRadioStationAddPending) {
      focusRadioStationAddPending = false
      settingsModal.startAddingRadioStation()
    }
  }

  function openSettings(page, focusRadioStationAdd) {
    requestedSettingsPage = page || "reading"
    focusRadioStationAddPending = focusRadioStationAdd === true
    applicationView.closeStudy()
    radioOpened = false
    verseOfTheDayOpened = false
    settingsLoaded = true
    settingsOpenPending = true
    Qt.callLater(function() { root.finishOpeningSettings() })
  }

  function cycleRadioSkin() {
    persistStudyOptions({ radioSkin: RadioSkins.next(studyOptions.radioSkin, studyOptions.radioSkinOrder) })
  }

  // Navigation shortcuts switch surfaces rather than silently doing nothing
  // when an overlay has focus. This keeps the whole application keyboard-first.
  function openStudy(page) {
    settingsOpenPending = false
    if (settingsModal) settingsModal.close()
    radioOpened = false
    verseOfTheDayOpened = false
    applicationView.openStudy(page)
  }

  function currentDayOfYear() {
    var now = new Date()
    return (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
      - Date.UTC(now.getFullYear(), 0, 0)) / 86400000
  }

  function dailyDateKey() {
    var now = new Date()
    return now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate()
  }

  function scheduleDailyVerse(retry) {
    dailyVerseTimer.stop()
    if (!verseOfTheDayEnabled) return
    var now = new Date()
    var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    var delay = Math.max(1000, midnight.getTime() - now.getTime())
    if (retry) delay = Math.min(delay, Math.min(60, Math.pow(2, Math.min(verseOfTheDayFailures, 6))) * 60000)
    dailyVerseTimer.interval = delay
    dailyVerseTimer.start()
  }

  function verseOfTheDayVersion() {
    return accountAuthenticated ? applicationView.selectedVersion : ""
  }

  function preloadVerseOfTheDay() {
    if (!accountAuthenticated || !verseOfTheDayEnabled || verseOfTheDayVersion() === "") return
    requestVerseOfTheDay("auto", false)
    if (!dailyVerseTimer.running) scheduleDailyVerse(false)
  }

  function refreshVerseOfTheDay() {
    requestVerseOfTheDay("online", true)
  }

  function requestVerseOfTheDay(mode, force) {
    if (!api || !accountAuthenticated || verseOfTheDayVersion() === "" || verseOfTheDayLoading) return
    var day = currentDayOfYear()
    var version = verseOfTheDayVersion()
    if (!force && verseOfTheDayLoadedDate === dailyDateKey()
        && verseOfTheDayLoadedDay === day && verseOfTheDayLoadedVersion === version
        && verseOfTheDayPassage && verseOfTheDayPassage.content) return
    verseOfTheDayLoading = true
    verseOfTheDayError = ""
    verseOfTheDayRequestedVersion = version
    verseOfTheDayRequestedDate = dailyDateKey()
    api.get(
      "/v1/verse-of-the-day?version=" + encodeURIComponent(version)
        + "&mode=" + encodeURIComponent(mode),
      "panel.verse-of-the-day"
    )
  }

  function normalizedSecondaryBibleLanguages(value) {
    return PreferenceUtils.secondaryBibleLanguages(
      value,
      I18n.bibleLanguage(systemLocale)
    )
  }

  function persistSecondaryBibleLanguages(value) {
    secondaryBibleLanguages = normalizedSecondaryBibleLanguages(value)
    api.put(
      "/v1/user-data/preferences/secondary-bible-languages",
      { languages: secondaryBibleLanguages },
      "panel.secondary-bible-languages-save"
    )
  }

  function persistStudyOptions(value) {
    studyOptionsRevision++
    var next = ({})
    for (var key in studyOptions) next[key] = studyOptions[key]
    for (var changed in value) next[changed] = value[changed]
    studyOptions = next
    api.put("/v1/study/options", value, "panel.study-options-save:" + studyOptionsRevision)
  }

  function persistReaderTabs(value) {
    api.put(
      "/v1/user-data/preferences/reader-tabs",
      value,
      "panel.reader-tabs-save"
    )
  }

  function persistKeybindings(value) {
    api.put(
      "/v1/user-data/preferences/keybindings",
      { keybindings: value },
      "panel.keybindings-save"
    )
  }

  function adjustBrightnessFromWheel(delta) {
    var amount = Number(delta)
    if (!isFinite(amount) || amount === 0) return false
    var accumulator = brightnessWheelAccumulator + amount
    var steps = accumulator > 0 ? Math.floor(accumulator / 120) : Math.ceil(accumulator / 120)
    brightnessWheelAccumulator = accumulator - steps * 120
    if (steps === 0) return false
    root.previewBrightness(root.textBrightness + steps * 0.05)
    return true
  }

  function adjustScaleFromWheel(delta, adjustAppSize) {
    var amount = Number(delta)
    if (!isFinite(amount) || amount === 0) return false
    var accumulator = adjustAppSize
      ? root.appWheelAccumulator + amount
      : root.readerWheelAccumulator + amount
    var steps = accumulator > 0
      ? Math.floor(accumulator / 120)
      : Math.ceil(accumulator / 120)
    if (adjustAppSize) root.appWheelAccumulator = accumulator - steps * 120
    else root.readerWheelAccumulator = accumulator - steps * 120
    if (steps === 0) return false
    if (adjustAppSize) root.previewAppScale(root.appScale + steps * 0.05)
    else root.previewReaderTextScale(root.readerTextScale + steps * 0.05)
    return true
  }

  function panelContentHeight() {
    if (root.verseOfTheDayOpened && verseOfTheDayPopup)
      return verseOfTheDayPopup.preferredHeight
    if (root.radioOpened && radioPlayer) return radioPlayer.preferredHeight

    var naturalHeight = root.settingsOpened
      ? Style.space(760)
      : applicationView.preferredContentHeight
    var scaledHeight = naturalHeight * root.appScale

    // The opening view hugs its controls; the controls already account for
    // text sizing, so scaling the available height adds empty space.
    if (!root.settingsOpened && !applicationView.readerExpanded && !applicationView.studyOpened)
      return applicationView.collapsedContentHeight
    return scaledHeight
  }

  function setCenterHoverRevealSuppressed(value) {
    // Optional host enhancement: a changed/throwing bar API must never keep
    // our input surface open or prevent the reader from receiving focus.
    // qmllint disable missing-property
    try {
      if (bar && typeof bar.setCenterHoverRevealSuppressed === "function")
        bar.setCenterHoverRevealSuppressed(value)
    } catch (error) {
      console.warn("Light: optional bar hover API unavailable: " + error)
    }
    // qmllint enable missing-property
  }

  function open() {
    root.refreshAccountStatus()
    root.preloadVerseOfTheDay()
    applicationView.collapseReader()
    root.controller.show()
    Qt.callLater(function() {
      if (!root.opened) return
      root.setCenterHoverRevealSuppressed(true)
      applicationView.prepareForImmediateTyping()
      if (!root.studyOptions.resumeReading) applicationView.resumeLastPassage()
    })
    focusAfterMap.restart()
  }

  function close() {
    // Release input first, even if optional UI cleanup fails after an update.
    root.controller.hide()
    root.settingsOpenPending = false
    focusAfterMap.stop()
    root.setCenterHoverRevealSuppressed(false)
    if (settingsModal) settingsModal.close()
    radioOpened = false
    verseOfTheDayOpened = false
    verseOfTheDayLoading = false
    applicationView.closeStudy()
    applicationView.collapseReader()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function closeCurrentPage() {
    if (applicationView.studyOpened) { applicationView.closeStudy(); return }
    if (root.radioOpened) {
      root.closeRadio()
      return
    }
    if (root.verseOfTheDayOpened) {
      root.close()
      return
    }
    if (root.settingsOpened) {
      settingsModal.closeCurrentPage()
      return
    }
    root.close()
  }

  function closeForPopoutSwitch() {
    root.popoutSwitchClosing = true
    root.close()
    Qt.callLater(function() { root.popoutSwitchClosing = false })
  }

  function switchPanel(direction) {
    // The bar's runtime plugin API is not represented in its QtObject type.
    // qmllint disable missing-property
    if (bar && typeof bar.switchPanelFrom === "function")
      return bar.switchPanelFrom(barIdentity, direction)
    // qmllint enable missing-property
    return false
  }

  Timer {
    id: focusAfterMap
    interval: 100
    onTriggered: {
      if (root.opened && !root.settingsOpened && !root.radioOpened)
        applicationView.ensureTypingFocus()
    }
  }

  LightApi {
    id: api
    baseUrl: root.serviceBaseUrl
    appLanguage: root.appLanguage
  }

  function refreshAccountStatus() {
    api.get("/v1/auth/status", "panel.auth")
  }

  Timer {
    interval: 10000
    repeat: true
    running: root.opened
    onTriggered: root.refreshAccountStatus()
  }

  Timer {
    id: appScaleSaveTimer
    interval: 350
    onTriggered: root.persistAppScale(root.appScale)
  }

  Timer {
    id: readerTextScaleSaveTimer
    interval: 350
    onTriggered: root.persistReaderTextScale(root.readerTextScale)
  }

  Connections {
    target: api

    function onSucceeded(tag, payload, status) {
      if (tag === "panel.auth") {
        root.accountAuthenticated = payload && payload.authenticated === true
        return
      }
      if (tag === "panel.study-options" || String(tag).indexOf("panel.study-options-save:") === 0) {
        root.confirmedStudyOptions = payload
        if (tag === "panel.study-options" || Number(String(tag).split(":")[1]) === root.studyOptionsRevision)
          root.studyOptions = payload
        return
      }
      if (tag === "panel.app-scale" || tag === "panel.app-scale-save") {
        if (payload && payload.appScale !== undefined)
          root.appScale = root.normalizedAppScale(payload.appScale)
      } else if (tag === "panel.reader-text-scale" || tag === "panel.reader-text-scale-save") {
        if (payload && payload.readerTextScale !== undefined)
          root.readerTextScale = root.normalizedReaderTextScale(payload.readerTextScale)
      } else if (tag === "panel.reader-font-style" || tag === "panel.reader-font-style-save") {
        if (payload && payload.readerFontStyle !== undefined)
          root.readerFontStyle = root.normalizedReaderFontStyle(payload.readerFontStyle)
      } else if (tag === "panel.red-letters" || tag === "panel.red-letters-save") {
        if (payload && payload.redLetters !== undefined)
          root.redLetters = payload.redLetters === true
      } else if (tag === "panel.verse-of-the-day-enabled" || tag === "panel.verse-of-the-day-save") {
        if (payload && payload.verseOfTheDayEnabled !== undefined)
          root.verseOfTheDayEnabled = payload.verseOfTheDayEnabled === true
      } else if (tag === "panel.music-player"
                 || String(tag).indexOf("panel.music-player-reconcile:") === 0
                 || String(tag).indexOf("settings.music-player-save:") === 0) {
        if (payload && payload.musicPlayerEnabled !== undefined) {
          var confirmedMusicPlayer = payload.musicPlayerEnabled === true
          root.confirmedMusicPlayerEnabled = confirmedMusicPlayer
          var isInitialMusicLoad = tag === "panel.music-player"
          var musicRevision = isInitialMusicLoad
            ? 0
            : root.saveRevision(tag, String(tag).indexOf("settings.") === 0
              ? "settings.music-player-save:"
              : "panel.music-player-reconcile:")
          if ((isInitialMusicLoad && root.musicPlayerRevision === 0)
              || musicRevision === root.musicPlayerRevision) {
            root.musicPlayerEnabled = confirmedMusicPlayer
            if (!confirmedMusicPlayer) root.radioOpened = false
          }
        }
      } else if (tag === "panel.custom-radio-stations"
                 || String(tag).indexOf("panel.custom-radio-stations-reconcile:") === 0
                 || String(tag).indexOf("settings.custom-radio-stations-save:") === 0) {
        if (payload && payload.customRadioStations !== undefined) {
          var confirmedCustomStations = root.normalizedCustomRadioStations(
            payload.customRadioStations
          )
          root.confirmedCustomRadioStations = confirmedCustomStations
          var isInitialCustomLoad = tag === "panel.custom-radio-stations"
          var customRevision = isInitialCustomLoad
            ? 0
            : root.saveRevision(tag, String(tag).indexOf("settings.") === 0
              ? "settings.custom-radio-stations-save:"
              : "panel.custom-radio-stations-reconcile:")
          if ((isInitialCustomLoad && root.customRadioStationsRevision === 0)
              || customRevision === root.customRadioStationsRevision)
            root.customRadioStations = confirmedCustomStations
        }
      } else if (tag === "panel.hidden-radio-stations"
                 || String(tag).indexOf("panel.hidden-radio-stations-reconcile:") === 0
                 || String(tag).indexOf("settings.hidden-radio-stations-save:") === 0) {
        if (payload && payload.hiddenRadioStationIds !== undefined) {
          var confirmedHiddenStations = root.normalizedHiddenRadioStationIds(
            payload.hiddenRadioStationIds
          )
          root.confirmedHiddenRadioStationIds = confirmedHiddenStations
          var isInitialHiddenLoad = tag === "panel.hidden-radio-stations"
          var hiddenRevision = isInitialHiddenLoad
            ? 0
            : root.saveRevision(tag, String(tag).indexOf("settings.") === 0
              ? "settings.hidden-radio-stations-save:"
              : "panel.hidden-radio-stations-reconcile:")
          if ((isInitialHiddenLoad && root.hiddenRadioStationIdsRevision === 0)
              || hiddenRevision === root.hiddenRadioStationIdsRevision)
            root.hiddenRadioStationIds = confirmedHiddenStations
        }
      } else if (tag === "panel.radio-station-order"
                 || String(tag).indexOf("panel.radio-station-order-reconcile:") === 0
                 || String(tag).indexOf("settings.radio-station-order-save:") === 0) {
        if (payload && payload.radioStationOrder !== undefined) {
          var confirmedStationOrder = root.normalizedRadioStationOrder(
            payload.radioStationOrder
          )
          root.confirmedRadioStationOrder = confirmedStationOrder
          var isInitialOrderLoad = tag === "panel.radio-station-order"
          var orderRevision = isInitialOrderLoad
            ? 0
            : root.saveRevision(tag, String(tag).indexOf("settings.") === 0
              ? "settings.radio-station-order-save:"
              : "panel.radio-station-order-reconcile:")
          if ((isInitialOrderLoad && root.radioStationOrderRevision === 0)
              || orderRevision === root.radioStationOrderRevision)
            root.radioStationOrder = confirmedStationOrder
        }
      } else if (tag === "panel.settings-section-order"
                 || String(tag).indexOf("panel.settings-section-order-reconcile:") === 0
                 || String(tag).indexOf("settings.section-order-save:") === 0) {
        if (payload && payload.settingsSectionOrder !== undefined) {
          var confirmedSectionOrder = root.normalizedSettingsSectionOrder(
            payload.settingsSectionOrder
          )
          root.confirmedSettingsSectionOrder = confirmedSectionOrder
          var isInitialSectionOrderLoad = tag === "panel.settings-section-order"
          var sectionOrderRevision = isInitialSectionOrderLoad
            ? 0
            : root.saveRevision(tag, String(tag).indexOf("settings.") === 0
              ? "settings.section-order-save:"
              : "panel.settings-section-order-reconcile:")
          if ((isInitialSectionOrderLoad && root.settingsSectionOrderRevision === 0)
              || sectionOrderRevision === root.settingsSectionOrderRevision)
            root.settingsSectionOrder = confirmedSectionOrder
        }
      } else if (tag === "panel.verse-of-the-day") {
        root.verseOfTheDayLoading = false
        if (payload && payload.data && payload.data.passage) {
          root.verseOfTheDayPassage = payload.data.passage
          root.verseOfTheDayLoadedDay = Number(payload.data.day || root.currentDayOfYear())
          root.verseOfTheDayLoadedVersion = root.verseOfTheDayRequestedVersion
          root.verseOfTheDayLoadedDate = root.verseOfTheDayRequestedDate
          root.verseOfTheDayFailures = 0
          root.scheduleDailyVerse(false)
        }
      } else if (tag === "panel.secondary-bible-languages"
                 || tag === "panel.secondary-bible-languages-save") {
        if (payload && payload.secondaryBibleLanguages !== undefined)
          root.secondaryBibleLanguages = root.normalizedSecondaryBibleLanguages(
            payload.secondaryBibleLanguages
          )
      } else if (tag === "panel.reader-tabs" || tag === "panel.reader-tabs-save") {
        root.readerTabs = payload && payload.tabs instanceof Array
          ? payload
          : ({ tabs: [], activeTabIndex: -1 })
        root.readerTabsLoaded = true
        if (root.restoringBackup && tag === "panel.reader-tabs") {
          root.restoringBackup = false
          Qt.callLater(function() { applicationView.restoreSavedTabs() })
        }
      } else if (tag === "panel.keybindings" || tag === "panel.keybindings-save") {
        if (payload && payload.keybindings) root.keybindings = payload.keybindings
      }
    }

    function onFailed(tag, message, status, payload) {
      if (tag === "panel.auth") {
        root.accountAuthenticated = false
        return
      }
      if (String(tag).indexOf("panel.study-options-save:") === 0) {
        if (root.settingsModal) root.settingsModal.errorMessage = message
        if (Number(String(tag).split(":")[1]) === root.studyOptionsRevision)
          root.studyOptions = root.confirmedStudyOptions
      }
      if (tag === "panel.keybindings-save" && root.settingsModal)
        root.settingsModal.showShortcutConflict(message)
      if (tag === "panel.reader-tabs") root.readerTabsLoaded = true
      if (String(tag).indexOf("settings.music-player-save:") === 0) {
        var musicRevision = root.saveRevision(tag, "settings.music-player-save:")
        if (musicRevision === root.musicPlayerRevision)
          root.musicPlayerEnabled = root.confirmedMusicPlayerEnabled
        api.get(
          "/v1/user-data/preferences/music-player",
          "panel.music-player-reconcile:" + root.musicPlayerRevision
        )
      } else if (String(tag).indexOf("settings.custom-radio-stations-save:") === 0) {
        var customRevision = root.saveRevision(tag, "settings.custom-radio-stations-save:")
        if (customRevision === root.customRadioStationsRevision)
          root.customRadioStations = root.confirmedCustomRadioStations.slice(0)
        api.get(
          "/v1/user-data/preferences/custom-radio-stations",
          "panel.custom-radio-stations-reconcile:" + root.customRadioStationsRevision
        )
      } else if (String(tag).indexOf("settings.hidden-radio-stations-save:") === 0) {
        var hiddenRevision = root.saveRevision(tag, "settings.hidden-radio-stations-save:")
        if (hiddenRevision === root.hiddenRadioStationIdsRevision)
          root.hiddenRadioStationIds = root.confirmedHiddenRadioStationIds.slice(0)
        api.get(
          "/v1/user-data/preferences/hidden-radio-stations",
          "panel.hidden-radio-stations-reconcile:" + root.hiddenRadioStationIdsRevision
        )
      } else if (String(tag).indexOf("settings.radio-station-order-save:") === 0) {
        var orderRevision = root.saveRevision(tag, "settings.radio-station-order-save:")
        if (orderRevision === root.radioStationOrderRevision)
          root.radioStationOrder = root.confirmedRadioStationOrder.slice(0)
        api.get(
          "/v1/user-data/preferences/radio-station-order",
          "panel.radio-station-order-reconcile:" + root.radioStationOrderRevision
        )
      } else if (String(tag).indexOf("settings.section-order-save:") === 0) {
        var sectionOrderRevision = root.saveRevision(tag, "settings.section-order-save:")
        if (sectionOrderRevision === root.settingsSectionOrderRevision)
          root.settingsSectionOrder = root.confirmedSettingsSectionOrder.slice(0)
        api.get(
          "/v1/user-data/preferences/settings-section-order",
          "panel.settings-section-order-reconcile:" + root.settingsSectionOrderRevision
        )
      }
      if (tag === "panel.verse-of-the-day") {
        root.verseOfTheDayLoading = false
        root.verseOfTheDayFailures += 1
        root.scheduleDailyVerse(true)
        if (!root.verseOfTheDayPassage || !root.verseOfTheDayPassage.content)
          root.verseOfTheDayError = String(message || I18n.t(root.appLanguage, "serviceUnreachable"))
      }
    }
  }

  Component.onCompleted: {
    reloadPreferences()
    refreshAccountStatus()
  }

  function reloadPreferences() {
    api.get("/v1/study/options", "panel.study-options")
    api.get("/v1/user-data/preferences/app-scale", "panel.app-scale")
    api.get(
      "/v1/user-data/preferences/reader-text-scale",
      "panel.reader-text-scale"
    )
    api.get(
      "/v1/user-data/preferences/reader-font-style",
      "panel.reader-font-style"
    )
    api.get(
      "/v1/user-data/preferences/red-letters",
      "panel.red-letters"
    )
    api.get(
      "/v1/user-data/preferences/verse-of-the-day",
      "panel.verse-of-the-day-enabled"
    )
    api.get("/v1/user-data/preferences/music-player", "panel.music-player")
    api.get(
      "/v1/user-data/preferences/custom-radio-stations",
      "panel.custom-radio-stations"
    )
    api.get(
      "/v1/user-data/preferences/hidden-radio-stations",
      "panel.hidden-radio-stations"
    )
    api.get(
      "/v1/user-data/preferences/radio-station-order",
      "panel.radio-station-order"
    )
    api.get(
      "/v1/user-data/preferences/settings-section-order",
      "panel.settings-section-order"
    )
    api.get(
      "/v1/user-data/preferences/secondary-bible-languages",
      "panel.secondary-bible-languages"
    )
    api.get("/v1/user-data/preferences/keybindings", "panel.keybindings")
    root.preloadVerseOfTheDay()
  }

  onVerseOfTheDayEnabledChanged: {
    if (verseOfTheDayEnabled) preloadVerseOfTheDay()
    else dailyVerseTimer.stop()
  }

  Timer {
    id: dailyVerseTimer
    repeat: false
    onTriggered: root.preloadVerseOfTheDay()
  }

  // A cheap local guard catches wall-clock/timezone changes and delayed timers
  // after sleep. It does not fetch again when today's verse is already loaded.
  Timer {
    interval: 60 * 60 * 1000
    running: root.verseOfTheDayEnabled
    repeat: true
    onTriggered: {
      if (root.verseOfTheDayFailures === 0) {
        root.preloadVerseOfTheDay()
        root.scheduleDailyVerse(false)
      }
    }
  }

  KeyboardPanel {
    id: dropdown
    objectName: "lightKeyboardPanel"
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    padding: !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened
      && !applicationView.readerExpanded ? Style.spacing.xs : Style.spacing.popupPadding
    open: root.opened
    // Book search owns focus immediately so typing is the primary interaction.
    focusTarget: root.radioOpened && root.radioPlayer
      ? root.radioPlayer.focusTarget
      : (applicationView.inputItem || keyCatcher)
    contentWidth: dropdown.fittedContentWidth(Style.space(560) * root.appScale)
    contentHeight: dropdown.fittedContentHeight(
      root.panelContentHeight(),
      Style.space(760) * root.appScale
    )

    Item {
      width: 0
      height: 0
      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.closeCurrentPage)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !applicationView.searchSuggestionsOpen
        autoRepeat: false
        onActivated: root.closeCurrentPage()
      }
    }

    Item {
      id: keyCatcher
      anchors.fill: parent
      Rectangle {
        anchors.fill: parent
        anchors.margins: -dropdown.padding
        color: "#000000"
        visible: LightPalette.nightMode
        z: -1
      }
      focus: true
      Keys.onPressed: function(event) {
        if (applicationView.keyboardInputActive || root.settingsOpened || root.radioOpened) return
        if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) {
          root.switchPanel((event.modifiers & Qt.ShiftModifier) || event.key === Qt.Key_Backtab ? -1 : 1)
          event.accepted = true
        }
      }

      // Window shortcuts work even when a button or text field owns focus.
      // Keep them local to Light, and let shortcut capture receive raw keys.
      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.navigateUp)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !applicationView.studyOpened
        autoRepeat: true
        onActivated: {
          if (root.settingsOpened) root.settingsModal.navigateByArrow(-1)
          else if (root.radioOpened && root.radioPlayer) root.radioPlayer.changeStation(-1)
          else applicationView.navigateByArrow(-1)
        }
      }
      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.navigateDown)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !applicationView.studyOpened
        autoRepeat: true
        onActivated: {
          if (root.settingsOpened) root.settingsModal.navigateByArrow(1)
          else if (root.radioOpened && root.radioPlayer) root.radioPlayer.changeStation(1)
          else applicationView.navigateByArrow(1)
        }
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.radioPrevious)
        context: Qt.WindowShortcut
        enabled: root.opened && root.radioOpened && root.radioPlayer
          && !root.radioPlayer.searchInputActive && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.radioPlayer.changeStation(-1)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.radioNext)
        context: Qt.WindowShortcut
        enabled: root.opened && root.radioOpened && root.radioPlayer
          && !root.radioPlayer.searchInputActive && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.radioPlayer.changeStation(1)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.radioPlayPause)
        context: Qt.WindowShortcut
        enabled: root.opened && root.radioOpened && root.radioPlayer
          && !root.radioPlayer.searchInputActive && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.radioPlayer.togglePlayback()
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.radioPrevious)
        context: Qt.WindowShortcut
        enabled: root.opened && !root.radioOpened && !root.settingsOpened
          && !applicationView.keyboardInputActive && !applicationView.studyOpened && root.shortcutCaptureIdle
        onActivated: applicationView.navigateChapter(-1)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.radioNext)
        context: Qt.WindowShortcut
        enabled: root.opened && !root.radioOpened && !root.settingsOpened
          && !applicationView.keyboardInputActive && !applicationView.studyOpened && root.shortcutCaptureIdle
        onActivated: applicationView.navigateChapter(1)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.textIncrease).concat([root.keybindings.textIncreaseUp, root.keybindings.textIncreaseRight])
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !applicationView.studyOpened
        autoRepeat: true
        onActivated: root.adjustReaderTextScale(0.1)
      }

      Shortcut {
        sequences: [root.keybindings.textDecrease, root.keybindings.textDecreaseDown, root.keybindings.textDecreaseLeft]
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !applicationView.studyOpened
        autoRepeat: true
        onActivated: root.adjustReaderTextScale(-0.1)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.toggleReaderFontStyle)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !applicationView.studyOpened
        autoRepeat: false
        onActivated: root.toggleReaderFontStyle()
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.brightnessIncrease).concat([root.keybindings.brightnessIncreaseUp, root.keybindings.brightnessIncreaseRight])
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: true
        onActivated: root.previewBrightness(root.textBrightness + 0.05)
      }

      Shortcut {
        sequences: [root.keybindings.brightnessDecrease, root.keybindings.brightnessDecreaseDown, root.keybindings.brightnessDecreaseLeft]
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: true
        onActivated: root.previewBrightness(root.textBrightness - 0.05)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.toggleNightMode || "Ctrl+D")
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.persistStudyOptions({ nightMode: !LightPalette.nightMode })
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.appIncrease).concat([root.keybindings.appIncreaseUp, root.keybindings.appIncreaseRight])
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !applicationView.studyOpened
        autoRepeat: true
        onActivated: root.adjustAppScale(0.05)
      }

      Shortcut {
        sequences: [root.keybindings.appDecrease, root.keybindings.appDecreaseDown, root.keybindings.appDecreaseLeft]
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !applicationView.studyOpened
        autoRepeat: true
        onActivated: root.adjustAppScale(-0.05)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.newTab)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.openNewTab()
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.closeTab)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.closeActiveTab()
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.nextTab)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.cycleTabs(1)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.previousTab)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.cycleTabs(-1)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.freshInput)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened
          && !root.verseOfTheDayOpened && !applicationView.keyboardInputActive
        autoRepeat: false
        onActivated: applicationView.startNewSearch()
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.tab1)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.selectTab(0)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.tab2)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.selectTab(1)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.tab3)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.selectTab(2)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.tab4)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.selectTab(3)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.tab5)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.selectTab(4)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.tab6)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.selectTab(5)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.tab7)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened && !root.radioOpened && !root.verseOfTheDayOpened && !applicationView.studyOpened
        autoRepeat: false
        onActivated: applicationView.selectTab(6)
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.openSettings)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle && !root.settingsOpened
        onActivated: root.openSettings()
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.settingsReading || "Ctrl+Shift+1")
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.openSettings("reading")
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.settingsAccount || "Ctrl+Shift+2")
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.openSettings("account")
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.settingsBackup || "Ctrl+Shift+3")
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.openSettings("backup")
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.settingsAppearance || "Ctrl+Shift+4")
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.openSettings("appearance")
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.settingsRadio || "Ctrl+Shift+5")
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.openSettings("radio")
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.settingsShortcuts || "Ctrl+Shift+6")
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.openSettings("shortcuts")
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.settingsLanguages || "Ctrl+Shift+7")
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.openSettings("languages")
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.cycleRadioSkin || "Ctrl+Shift+M")
        context: Qt.WindowShortcut
        enabled: root.opened && root.musicPlayerEnabled && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.cycleRadioSkin()
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.openRadio)
        context: Qt.WindowShortcut
        enabled: root.opened && root.musicPlayerEnabled && root.shortcutCaptureIdle
        onActivated: root.openRadio()
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.openLibrary)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.openStudy("library")
      }

      Shortcut {
        sequences: ShortcutUtils.expandedSequences(root.keybindings.openHistory)
        context: Qt.WindowShortcut
        enabled: root.opened && root.shortcutCaptureIdle
        autoRepeat: false
        onActivated: root.openStudy("history")
      }

      ApplicationContainer {
        id: applicationContainer
        anchors.fill: parent
        showHeader: false
        appScale: root.appScale

        LightView {
          id: applicationView
          objectName: "lightView"
          width: applicationContainer.contentWidth
          height: applicationContainer.contentHeight
          api: api
          accountAuthenticated: root.accountAuthenticated
          keybindings: root.keybindings
          appScale: root.appScale
          readerTextScale: root.readerTextScale
          readerFontStyle: root.readerFontStyle
          redLetters: root.redLetters
          musicPlayerEnabled: root.musicPlayerEnabled
          appLanguage: root.appLanguage
          systemLocale: root.systemLocale
          secondaryBibleLanguages: root.secondaryBibleLanguages
          savedTabState: root.readerTabs
          tabStateLoaded: root.readerTabsLoaded
          compactSearch: root.studyOptions.resumeReading
          autoOpenReferences: root.studyOptions.autoOpenReferences === true
          onSettingsRequested: root.openSettings()
          onRadioRequested: root.openRadio()
          onCloseRequested: root.closeCurrentPage()
          onReadingFocusRequested: keyCatcher.forceActiveFocus()
          onTabsCommitRequested: function(state) { root.persistReaderTabs(state) }
          visible: root.accountAuthenticated && !root.verseOfTheDayOpened
        }
      }

      Item {
        anchors.fill: parent
        visible: !root.accountAuthenticated

        Column {
          anchors.centerIn: parent
          width: Math.max(Style.space(200), parent.width - Style.spacing.xl * 2)
          spacing: Style.spacing.md

          Text {
            width: parent.width
            text: I18n.t(root.appLanguage, "signInToRead")
            color: LightPalette.popupText
            font.family: Style.font.family
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
            horizontalAlignment: Text.AlignHCenter
          }

          SettingsControlButton {
            width: parent.width
            text: I18n.t(root.appLanguage, "signInYouVersion")
            onClicked: root.openSettings("account")
          }
        }
      }

      // Secondary views are constructed on first use. Keeping them outside
      // ApplicationContainer also prevents its scrolling Column from
      // collapsing overlay geometry.
      Loader {
        id: verseLoader
        anchors.fill: parent
        active: root.verseOfTheDayOpened
        asynchronous: false

        sourceComponent: Component {
          VerseOfTheDayPopup {
            anchors.fill: parent
            opened: root.verseOfTheDayOpened
            loading: root.verseOfTheDayLoading
            passage: root.verseOfTheDayPassage
            versionLabel: applicationView.selectedVersionLabel
            errorMessage: root.verseOfTheDayError
            appLanguage: root.appLanguage
            appScale: root.appScale
            textPixelSize: applicationView.readerTextPixelSize
            readerFontStyle: root.readerFontStyle
            onRefreshRequested: root.refreshVerseOfTheDay()
            onCloseRequested: root.close()
          }
        }
      }

      // Once requested, the player stays loaded while the feature is enabled;
      // closing or hiding Light therefore never interrupts active audio.
      Loader {
        id: radioLoader
        anchors.fill: parent
        active: root.musicPlayerEnabled
          && (root.radioPlayerLoaded || root.radioOpened)
        asynchronous: true
        onLoaded: if (root.radioOpened && root.radioPlayer) root.radioPlayer.focusTarget.forceActiveFocus()

        sourceComponent: Component {
          RadioPlayer {
            objectName: "lightRadioPlayer"
            verseOfTheDayEnabled: root.verseOfTheDayEnabled
            verseOfTheDayPassage: root.verseOfTheDayPassage
            anchors.fill: parent
            opened: root.radioOpened
            appScale: root.appScale
            appLanguage: root.appLanguage
            keybindings: root.keybindings
            customStations: root.customRadioStations
            hiddenStationIds: root.hiddenRadioStationIds
            stationOrder: root.radioStationOrder
            favoriteStations: root.studyOptions.favoriteStations || []
            skin: Number(root.studyOptions.radioSkin || 1)
            skinOrder: root.studyOptions.radioSkinOrder || []
            onSkinCommitRequested: function(skin) {
              root.persistStudyOptions({ radioSkin: skin })
            }
            onSkinOrderCommitRequested: function(order) {
              root.persistStudyOptions({ radioSkinOrder: order })
            }
            onFavoritesCommitRequested: function(keys) {
              root.persistStudyOptions({ favoriteStations: keys })
            }
            onCloseRequested: root.closeRadio()
            onSettingsRequested: root.openSettings("radio")
            onAddStationRequested: root.openSettings("radio", true)
            onDeleteStationRequested: function(station) { root.deleteRadioStation(station) }
            onStationOrderCommitRequested: function(stationKeys) {
              root.persistRadioStationOrder(stationKeys)
            }
          }
        }
      }

      Loader {
        id: settingsLoader
        anchors.fill: parent
        active: root.settingsLoaded
        asynchronous: true
        onLoaded: {
          if (root.opened) root.finishOpeningSettings()
        }

        sourceComponent: Component {
          SettingsModal {
            id: modal
            objectName: "lightSettings"
            anchors.fill: parent
            api: api
            versionOptions: applicationView.versionOptions
            selectedVersion: applicationView.selectedVersion
            selectedVersionLabel: applicationView.selectedVersionLabel
            appScale: root.appScale
            readerTextScale: root.readerTextScale
            readerFontStyle: root.readerFontStyle
            redLetters: root.redLetters
            resumeReading: root.studyOptions.resumeReading === true
            autoOpenReferences: root.studyOptions.autoOpenReferences === true
            favoriteStations: root.studyOptions.favoriteStations || []
            radioSkin: Number(root.studyOptions.radioSkin || 1)
            radioSkinOrder: root.studyOptions.radioSkinOrder || []
            onTextBrightnessPreviewRequested: function(value) { root.previewBrightness(value) }
            onTextBrightnessCommitRequested: function(value) { root.saveBrightness(value) }
            onStudyOptionsCommitRequested: function(options) {
              root.persistStudyOptions(options)
            }
            onBackupRestored: {
              root.restoringBackup = true
              applicationView.defaultHighlightColorRevision = 0
              applicationView.defaultHighlightOpacityRevision = 0
              root.reloadPreferences()
              applicationView.loadUserData(true)
              modal.refresh()
            }
            verseOfTheDayEnabled: root.verseOfTheDayEnabled
            musicPlayerEnabled: root.musicPlayerEnabled
            builtInRadioStations: RadioStations.builtInStations()
            customRadioStations: root.customRadioStations
            hiddenRadioStationIds: root.hiddenRadioStationIds
            radioStationOrder: root.radioStationOrder
            settingsSectionOrder: root.settingsSectionOrder
            appLanguage: root.appLanguage
            systemLocale: root.systemLocale
            bibleLanguageOptions: applicationView.bibleLanguageOptions
            secondaryBibleLanguages: root.secondaryBibleLanguages
            keybindings: root.keybindings
            onAppScalePreviewRequested: function(scale) { root.previewAppScale(scale) }
            onAppScaleCommitRequested: function(scale) { root.persistAppScale(scale) }
            onReaderTextScalePreviewRequested: function(scale) {
              root.previewReaderTextScale(scale)
            }
            onReaderTextScaleCommitRequested: function(scale) {
              root.persistReaderTextScale(scale)
            }
            onReaderFontStyleCommitRequested: function(style) {
              root.persistReaderFontStyle(style)
            }
            onRedLettersCommitRequested: function(enabled) {
              root.persistRedLetters(enabled)
            }
            onVerseOfTheDayCommitRequested: function(enabled) {
              root.persistVerseOfTheDayEnabled(enabled)
            }
            onMusicPlayerCommitRequested: function(enabled) {
              root.persistMusicPlayerEnabled(enabled)
            }
            onRadioSkinCommitRequested: function(skin) {
              root.persistStudyOptions({ radioSkin: skin })
            }
            onCustomRadioStationsCommitRequested: function(stations, operation) {
              root.persistCustomRadioStations(stations, operation)
            }
            onHiddenRadioStationIdsCommitRequested: function(stationIds, operation) {
              root.persistHiddenRadioStationIds(stationIds, operation)
            }
            onRadioStationOrderCommitRequested: function(stationKeys) {
              root.persistRadioStationOrder(stationKeys)
            }
            onSettingsSectionOrderCommitRequested: function(sectionIds) {
              root.persistSettingsSectionOrder(sectionIds)
            }
            onHighlightColorSelected: function(color) {
              applicationView.setDefaultHighlightColor(color, true)
            }
            onHighlightOpacitySelected: function(opacity) {
              applicationView.setDefaultHighlightOpacity(opacity, true)
            }
            onSecondaryBibleLanguagesCommitRequested: function(languages) {
              root.persistSecondaryBibleLanguages(languages)
            }
            onKeybindingsCommitRequested: function(bindings) {
              root.persistKeybindings(bindings)
            }
            onAccountSyncRequested: {
              root.refreshAccountStatus()
              applicationView.syncAccountHighlights()
            }
            onAuthenticationChanged: function(authenticated) {
              root.accountAuthenticated = authenticated
              root.refreshAccountStatus()
            }
            onSignInCompleted: {
              root.open()
              root.radioOpened = false
              root.verseOfTheDayOpened = false
              applicationView.closeStudy()
              modal.settingsPage = "account"
              modal.open()
              modal.notice = I18n.t(root.appLanguage, "signedInNotice")
            }
            onPanelCloseRequested: modal.close()
            onClosed: {
              if (root.opened && applicationView.inputItem)
                Qt.callLater(function() { applicationView.inputItem.forceActiveFocus() })
            }
          }
        }
      }

      MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.NoButton
        enabled: root.opened
        hoverEnabled: false
        propagateComposedEvents: true
        z: 2000

        onWheel: function(wheel) {
          var altPressed = Boolean(wheel.modifiers & Qt.AltModifier)
          var controlPressed = Boolean(wheel.modifiers & Qt.ControlModifier)
          // Ctrl+Alt adjusts brightness; Ctrl alone resizes text and Alt
          // alone resizes the app throughout Light.
          var resizeText = controlPressed && !altPressed
          if (!altPressed && !resizeText) {
            wheel.accepted = false
            return
          }

          var delta = ShortcutUtils.wheelDelta(
            wheel.angleDelta.x,
            wheel.angleDelta.y,
            wheel.pixelDelta.x,
            wheel.pixelDelta.y
          )
          if (controlPressed && altPressed) root.adjustBrightnessFromWheel(delta)
          else root.adjustScaleFromWheel(
            delta,
            altPressed
          )
          wheel.accepted = true
        }
      }
    }
  }
}
