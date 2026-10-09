pragma ComponentBehavior: Bound
import QtQuick
import QtMultimedia
import QtQuick.Controls as QQC
import qs.Commons
import "I18n.js" as I18n
import "RadioStations.js" as RadioStations
import "RadioSkins.js" as RadioSkins
import "PassageFormat.js" as PassageFormat
import "LightAudio"

FocusScope {
  id: root

  property bool opened: false
  property var keybindings: ({})
  property real appScale: 1.2
  property string appLanguage: "en-US"
  property var customStations: []
  property var hiddenStationIds: []
  property var stationOrder: []
  property var favoriteStations: []
  property int skin: 1
  property var skinOrder: []
  property bool favoritesOnly: false
  readonly property bool searchInputActive: stationSearch.inputActive
  readonly property var filteredStations: stations.filter(function(station) {
    var query = stationSearch.text.trim().toLowerCase()
    return (!favoritesOnly || favoriteStations.indexOf(stationKey(station)) >= 0)
      && (!query || (station.name + " " + (station.description || "")).toLowerCase().indexOf(query) >= 0)
  })
  signal favoritesCommitRequested(var stationKeys)
  signal skinCommitRequested(int skin)
  signal skinOrderCommitRequested(var order)
  property int currentStationIndex: 0
  property var selectedStation: null
  property real volume: 0.7
  property string statusMessage: ""
  property bool useDefaultStreamProbe: false
  property string requestedStreamSource: ""
  property int elapsedSeconds: 0
  property bool verseOfTheDayEnabled: false
  property var verseOfTheDayPassage: ({})
  readonly property var dailyVersePages: buildDailyVersePages()
  readonly property bool showingDailyVerse: dailyVersePages.length > 0
  property int draggedStationIndex: -1
  property var contextStation: null
  readonly property alias audioSourcePlayer: player

  LightTypography {
    id: typography
    appScale: root.appScale
  }

  readonly property real scaleFactor: typography.scaleFactor
  readonly property real unit: Math.min(scaleFactor, width / 550)
  readonly property real preferredHeight: Style.space(530) * scaleFactor
  readonly property int normalizedSkin: RadioSkins.normalize(skin)
  readonly property var skinSpec: RadioSkins.spec(normalizedSkin)
  readonly property var displayedSkinOrder: RadioSkins.normalizeOrder(skinOrder)
  readonly property color skinText: LightPalette.popupText
  readonly property color skinMuted: LightPalette.muted
  readonly property color skinAccent: LightPalette.accent
  readonly property color skinUrgent: LightPalette.urgent
  readonly property color skinBackground: LightPalette.nightMode ? LightPalette.background : normalizedSkin === 2
    ? Qt.tint(LightPalette.popupBackground, Util.alpha(LightPalette.accent, 0.055))
    : normalizedSkin === 3
      ? Qt.darker(LightPalette.popupBackground, 1.08)
      : normalizedSkin === 5
        ? Qt.tint(LightPalette.popupBackground, Util.alpha(LightPalette.popupText, 0.045))
        : normalizedSkin === 6
          ? Qt.tint(LightPalette.popupBackground, Util.alpha(LightPalette.muted, 0.08))
          : normalizedSkin === 7
            ? Qt.darker(LightPalette.popupBackground, 1.14)
            : LightPalette.popupBackground
  readonly property color skinInset: normalizedSkin === 2
    ? Qt.darker(skinBackground, 1.4)
    : normalizedSkin === 4
      ? Qt.darker(skinBackground, 1.4)
      : normalizedSkin === 5
        ? Qt.tint(skinBackground, Util.alpha(skinText, 0.055))
        : Qt.darker(skinBackground, normalizedSkin === 7 ? 1.3 : 1.5)
  readonly property color skinBorder: normalizedSkin === 2 || normalizedSkin === 5
    ? Qt.tint(skinBackground, Util.alpha(skinAccent, 0.48))
    : normalizedSkin === 3
      ? Qt.tint(skinBackground, Util.alpha(skinAccent, 0.6))
      : Qt.tint(skinBackground, Util.alpha(skinText, normalizedSkin === 4 ? 0.34 : 0.4))
  readonly property string skinFontFamily: skinSpec.font === "mono"
    ? "monospace" : Style.font.family
  readonly property real skinRadius: skinSpec.radius * root.unit
  readonly property real skinBorderWidth: skinSpec.borderWidth * root.unit
  function designX(value) { return value / 550 * card.width }
  readonly property color skinRaised: Qt.tint(skinBackground, Util.alpha(skinText, 0.17))
  readonly property color skinSurfaceTop: LightPalette.nightMode ? LightPalette.background : Qt.tint(skinBackground, Util.alpha(skinText, skinSpec.bevel ? 0.09 : 0.045))
  readonly property color skinSurfaceBottom: Qt.darker(skinBackground, 1.2)
  readonly property color skinShadow: Qt.darker(skinBackground, 2.1)
  readonly property color skinHover: Qt.tint(skinBackground, Util.alpha(skinText, 0.24))
  readonly property color skinHighlight: Qt.tint(skinBackground, Util.alpha(skinText, 0.48))
  readonly property color skinSelected: Qt.tint(skinInset, Util.alpha(skinAccent, 0.18))
  readonly property bool buffering: player.mediaStatus === MediaPlayer.LoadingMedia
    || player.mediaStatus === MediaPlayer.BufferingMedia
  readonly property string playbackLabel: buffering ? I18n.t(appLanguage, "radioConnecting")
    : I18n.t(appLanguage, playing ? "radioOnAir" : (paused ? "radioPaused" : "radioReady"))
  readonly property string elapsedText: ("0" + Math.floor(elapsedSeconds / 60) % 100).slice(-2)
    + ":" + ("0" + elapsedSeconds % 60).slice(-2)
  readonly property bool playing: player.playbackState === MediaPlayer.PlayingState
  readonly property bool paused: player.playbackState === MediaPlayer.PausedState
  readonly property var currentStation: selectedStation || (
    stations.length > 0
      ? stations[Math.max(0, Math.min(stations.length - 1, currentStationIndex))]
      : null
  )
  readonly property bool metadataMatchesCurrentStation: currentStation
    && currentStation.streamUrl
    && String(player.source) === String(currentStation.streamUrl)
  readonly property var streamMetadataPages: metadataMatchesCurrentStation
    ? buildMetadataPages(player.metaData)
    : []
  readonly property var currentDisplayPage: displayPageForVerse(dailyVersePages)
  readonly property string streamDetailsText: radioMetadata.title || streamMetadataPages.map(function(page) {
    return page.primary + (page.secondary ? " — " + page.secondary : "")
  }).join("   ·   ")

  function stationDetailsFor(station, isPlaying, details) {
    return isPlaying && currentStation && stationKey(station) === stationKey(currentStation)
      ? details : ""
  }

  function displayPageForVerse(verses) {
    if (verses.length > 0) return verses[0]
    return {
      primary: currentStation
        ? String(currentStation.name)
        : I18n.t(appLanguage, "radioNoStationsShort"),
      secondary: currentStation
        ? String(currentStation.description || I18n.t(appLanguage, "customRadioStation"))
        : ""
    }
  }
  readonly property alias focusTarget: playPauseButton
  readonly property var builtInStations: RadioStations.builtInStations()
  readonly property var visibleBuiltInStations: builtInStations.filter(function(station) {
    return hiddenStationIds.indexOf(String(station.id || "")) < 0
  })
  readonly property var stations: orderedStations(RadioStations.mergedStations(
    visibleBuiltInStations,
    customStations,
    builtInStations
  ))

  signal closeRequested()
  signal settingsRequested()
  signal addStationRequested()
  signal deleteStationRequested(var station)
  signal stationOrderCommitRequested(var stationKeys)

  onCurrentStationIndexChanged: {
    Qt.callLater(function() {
      var visibleIndex = stationIndexIn(filteredStations, stations[currentStationIndex])
      if (visibleIndex >= 0) stationList.positionViewAtIndex(visibleIndex, ListView.Contain)
    })
  }

  visible: opened
  z: 1200

  onStationsChanged: {
    if (selectedStation) {
      var selectedUrl = String(selectedStation.streamUrl || "")
      var selectedIndex = -1
      for (var i = 0; i < stations.length; i++) {
        if (String(stations[i].streamUrl || "") === selectedUrl) {
          selectedIndex = i
          break
        }
      }
      if (selectedIndex >= 0) currentStationIndex = selectedIndex
      else if (playing || paused) currentStationIndex = -1
      else selectedStation = null
    }
    if (!selectedStation) {
      if (stations.length === 0) currentStationIndex = 0
      else currentStationIndex = Math.max(0, Math.min(stations.length - 1, currentStationIndex))
    }
  }

  function open() {
    opened = true
    statusMessage = ""
    Qt.callLater(function() { playPauseButton.forceActiveFocus() })
  }

  function close() {
    closeRequested()
  }

  function navigateByArrow(direction) {
    if (filteredStations.length === 0) return
    var index = stationIndexIn(filteredStations, stations[currentStationIndex])
    var next = index < 0 ? (direction < 0 ? filteredStations.length - 1 : 0)
      : (index + direction + filteredStations.length) % filteredStations.length
    selectStation(stationIndexIn(stations, filteredStations[next]), true)
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

  function orderedStations(availableStations) {
    var source = availableStations instanceof Array ? availableStations : []
    var byKey = ({})
    var result = []
    for (var i = 0; i < source.length; i++) byKey[stationKey(source[i])] = source[i]
    var preferred = stationOrder instanceof Array ? stationOrder : []
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

  function reorderStation(fromIndex, insertionIndex) {
    if (fromIndex < 0 || fromIndex >= stations.length) return
    var target = Math.max(0, Math.min(stations.length, insertionIndex))
    if (fromIndex < target) target--
    if (target === fromIndex) return
    var reordered = stations.slice(0)
    var moved = reordered.splice(fromIndex, 1)[0]
    reordered.splice(target, 0, moved)
    var keys = []
    for (var i = 0; i < reordered.length; i++) keys.push(stationKey(reordered[i]))
    stationOrderCommitRequested(keys)
  }

  property int draggedSkinNumber: -1
  function reorderSkin(sourceSkin, targetSkin, placeAfter) {
    var order = displayedSkinOrder.slice(0)
    var from = order.indexOf(Number(sourceSkin))
    var target = order.indexOf(Number(targetSkin))
    if (from < 0 || target < 0 || from === target) return
    var moved = order.splice(from, 1)[0]
    target = order.indexOf(Number(targetSkin))
    order.splice(target + (placeAfter ? 1 : 0), 0, moved)
    skinOrderCommitRequested(order)
  }

  function reorderSkinAtPosition(sourceSkin, pickerX) {
    var slotWidth = 24 * unit + skinPicker.spacing
    var targetIndex = Math.max(0, Math.min(
      displayedSkinOrder.length - 1,
      Math.floor(Number(pickerX) / slotWidth)
    ))
    var targetSkin = displayedSkinOrder[targetIndex]
    var placeAfter = Number(pickerX) > targetIndex * slotWidth + 12 * unit
    reorderSkin(sourceSkin, targetSkin, placeAfter)
  }

  function stationNumber() {
    if (currentStationIndex < 0) return "--"
    var number = currentStationIndex + 1
    return number < 10 ? "0" + number : String(number)
  }

  function buildDailyVersePages() {
    if (!verseOfTheDayEnabled || !verseOfTheDayPassage || !verseOfTheDayPassage.content) return []
    // Remove publisher verse-number labels before flattening the passage HTML.
    var content = String(verseOfTheDayPassage.content).replace(
      /<(span|sup)\b[^>]*class=["'][^"']*\byv-vlbl\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, "")
    var text = PassageFormat.plainText(content).replace(/\s+/g, " ").trim()
    var citation = String(verseOfTheDayPassage.reference || "")
    return text ? [{ primary: text, secondary: I18n.t(root.appLanguage, "verseOfTheDay")
      + (citation ? " · " + citation : "") }] : []
  }

  function metadataValue(metaData, key) {
    if (!metaData) return ""
    try {
      return String(metaData.stringValue(key) || "").replace(/\s+/g, " ").trim()
    } catch (error) {
      return ""
    }
  }

  function appendMetadataPages(pages, primary, secondary) {
    var text = String(primary || "").replace(/\s+/g, " ").trim()
    if (text) pages.push({ primary: text, secondary: String(secondary || "") })
  }

  function buildMetadataPages(metaData) {
    var title = metadataValue(metaData, MediaMetaData.Title)
    var artist = metadataValue(metaData, MediaMetaData.ContributingArtist)
      || metadataValue(metaData, MediaMetaData.LeadPerformer)
      || metadataValue(metaData, MediaMetaData.AlbumArtist)
      || metadataValue(metaData, MediaMetaData.Author)
    var album = metadataValue(metaData, MediaMetaData.AlbumTitle)
    var details = [
      metadataValue(metaData, MediaMetaData.Description),
      metadataValue(metaData, MediaMetaData.Comment)
    ]

    // ICY streams commonly put both artist and track into Title.
    if (title !== "" && artist === "") {
      var combined = title.match(/^(.+?)\s+[\-–—]\s+(.+)$/)
      if (combined) {
        artist = combined[1].trim()
        title = combined[2].trim()
      }
    }

    var pages = []
    if (title !== "") appendMetadataPages(pages, title, artist)
    else if (artist !== "") appendMetadataPages(pages, artist, "")
    if (album !== "" && album !== title && album !== artist)
      appendMetadataPages(pages, album, artist || title)
    for (var i = 0; i < details.length; i++) {
      var detail = details[i]
      if (detail !== "" && detail !== title && detail !== artist && detail !== album
          && (i === 0 || detail !== details[0]))
        appendMetadataPages(pages, detail, title || artist)
    }
    return pages
  }

  function playCurrent() {
    var station = currentStation
    statusMessage = ""
    if (!station || !station.streamUrl) {
      if (!station || !station.siteUrl || !Qt.openUrlExternally(station.siteUrl))
        statusMessage = I18n.t(appLanguage, "radioBrowserFailed")
      else
        statusMessage = I18n.t(appLanguage, "radioOpenedInBrowser")
      return
    }
    var nextSource = String(station.streamUrl)
    requestedStreamSource = nextSource
    if (String(player.source) === nextSource && (playing || buffering)) return
    if (String(player.source) !== nextSource) {
      player.stop()
      elapsedSeconds = 0
      useDefaultStreamProbe = false
      player.source = nextSource
    }
    player.play()
  }

  function retryStreamWithDefaultProbe() {
    var retrySource = requestedStreamSource
    if (useDefaultStreamProbe || !retrySource || String(player.source) !== retrySource) return false
    useDefaultStreamProbe = true
    Qt.callLater(function() {
      // A stop or station change cancels this deferred retry.
      if (root.requestedStreamSource !== retrySource || String(player.source) !== retrySource) return
      player.source = ""
      player.source = retrySource
      player.play()
    })
    return true
  }

  function togglePlayback() {
    if (playing) pausePlayback()
    else playCurrent()
  }

  function pausePlayback() {
    requestedStreamSource = ""
    player.pause()
  }

  function openStationContextMenu(station, pointX, pointY) {
    contextStation = station
    var isPlayingStation = playing && stationKey(station) === stationKey(currentStation)
    stationContextMenu.options = [
      { label: I18n.t(appLanguage, isPlayingStation ? "pauseRadio" : "playRadio"), value: "toggle" },
      { label: I18n.t(appLanguage, "add"), value: "add" },
      { label: I18n.t(appLanguage, "deleteRadioStation"), value: "delete" }
    ]
    stationContextMenu.x = Math.max(0, Math.min(width - stationContextMenu.width, pointX))
    stationContextMenu.y = Math.max(0, Math.min(height - stationContextMenu.implicitHeight, pointY))
    stationContextMenu.open()
  }

  function runStationContextAction(action) {
    var station = contextStation
    if (action === "add") {
      addStationRequested()
    } else if (station && action === "toggle") {
      if (playing && stationKey(station) === stationKey(currentStation)) pausePlayback()
      else selectStation(stationIndexIn(stations, station), true)
    } else if (station && action === "delete") {
      if (stationKey(station) === stationKey(currentStation) && (playing || paused))
        stopPlayback()
      deleteStationRequested(station)
    }
    contextStation = null
  }

  function stopPlayback() {
    requestedStreamSource = ""
    player.stop()
    elapsedSeconds = 0
    statusMessage = I18n.t(appLanguage, "radioStopped")
  }

  function selectStation(index, beginPlaying) {
    if (stations.length === 0) return
    var normalized = ((Number(index) % stations.length) + stations.length) % stations.length
    var changed = normalized !== currentStationIndex
    if (changed && !beginPlaying) {
      requestedStreamSource = ""
      player.stop()
      elapsedSeconds = 0
    }
    currentStationIndex = normalized
    selectedStation = stations[normalized]
    statusMessage = ""
    if (beginPlaying) playCurrent()
  }

  function changeStation(direction) {
    if (filteredStations.length === 0) return
    navigateByArrow(direction)
  }

  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value)))
  }

  AudioOutput {
    id: audioOutput
    volume: root.volume * (1 - audioTap.scratchMix)
  }

  MediaPlayer {
    id: player
    objectName: "radioMediaPlayer"
    audioOutput: audioOutput
    // Direct radio audio needs only a small codec probe. Keep normal playback
    // buffering: low-latency mode discarded probed audio and delayed startup
    // in measured MP3/AAC streams. Unusual formats can retry the default probe.
    playbackOptions.probeSize: root.useDefaultStreamProbe ? -1 : 8192
    onErrorOccurred: function(error, errorString) {
      if (error === MediaPlayer.FormatError && root.retryStreamWithDefaultProbe()) return
      root.statusMessage = I18n.t(root.appLanguage, "radioPlaybackFailed", {
        message: String(errorString || error)
      })
    }
  }

  RadioMetadata {
    id: radioMetadata
    source: player.source
    active: root.playing && root.opened && root.metadataMatchesCurrentStation
  }

  AudioTap {
    id: audioTap
    objectName: "radioAudioTap"
    player: root.audioSourcePlayer
    gain: root.volume
    active: root.playing && !root.buffering && root.visible
    onMeasurementsChanged: skinArtwork.requestPaint()
  }

  Timer {
    interval: 1000
    running: root.playing && !root.buffering
    repeat: true
    onTriggered: root.elapsedSeconds++
  }

  // Theme-derived inset rims distinguish displays from raised controls.
  component DisplayRim: Rectangle {
    anchors.fill: parent
    anchors.margins: 3 * root.unit
    color: "transparent"
    radius: Math.max(0, Math.min(root.skinRadius, height / 2) - 3 * root.unit)
    border.width: root.unit
    border.color: root.skinShadow
    Rectangle {
      anchors.fill: parent
      anchors.margins: root.unit
      radius: Math.max(0, parent.radius - root.unit)
      gradient: Gradient {
        GradientStop { position: 0; color: Util.alpha(root.skinShadow, 0.42) }
        GradientStop { position: 0.22; color: "transparent" }
        GradientStop { position: 1; color: Util.alpha(root.skinHighlight, 0.045) }
      }
    }
  }

  // The chrome stays faithful to the reference; text and icons remain native
  // and legible at every supported application scale.
  component SkinButton: QQC.AbstractButton {
    id: control
    property string glyph: ""
    property string hint: ""
    property bool lit: false
    property real glyphSize: 22 * root.unit
    implicitWidth: (root.normalizedSkin === 3 ? 54 : 44) * root.unit
    implicitHeight: (root.normalizedSkin === 2 || root.normalizedSkin === 5 ? 44 : root.normalizedSkin === 3 ? 48 : 32) * root.unit
    focusPolicy: Qt.StrongFocus
    Accessible.name: hint || text
    Keys.onReturnPressed: clicked()
    Keys.onEnterPressed: clicked()
    background: Rectangle {
      id: buttonFace
      color: control.down ? root.skinInset : (control.hovered || control.activeFocus ? root.skinHover
        : control.lit ? Qt.tint(root.skinRaised, Util.alpha(root.skinAccent, 0.18)) : root.skinRaised)
      gradient: Gradient {
        GradientStop { position: 0; color: control.down ? root.skinShadow : Qt.lighter(buttonFace.color, 1.15) }
        GradientStop { position: 0.45; color: buttonFace.color }
        GradientStop { position: 1; color: control.down ? root.skinInset : Qt.darker(buttonFace.color, 1.3) }
      }
      border.color: control.activeFocus ? root.skinAccent : root.skinBorder
      border.width: Math.max(root.unit, root.skinBorderWidth / 2)
      radius: root.normalizedSkin === 5 || root.normalizedSkin === 2 ? height / 2 : Math.min(root.skinRadius, height / 2)
      Rectangle {
        z: -1
        x: 0; y: control.down ? root.unit : 3 * root.unit
        width: parent.width; height: parent.height
        radius: parent.radius
        color: Util.alpha(root.skinShadow, 0.8)
      }
      Rectangle {
        anchors.fill: parent
        anchors.margins: 2 * root.unit
        radius: Math.max(0, parent.radius - 2 * root.unit)
        color: "transparent"
        border.width: root.unit
        border.color: control.down ? root.skinShadow : root.skinHighlight
        opacity: root.skinSpec.bevel ? 0.8 : 0.4
      }
      Rectangle {
        x: 1; y: parent.height - 2; width: parent.width - 2; height: root.unit
        visible: root.skinSpec.bevel
        color: root.skinShadow
      }
    }
    contentItem: Item {
      transform: Translate { y: control.down ? root.unit : 0 }
      opacity: control.enabled ? 1 : 0.35
      PixelIcon {
        anchors.centerIn: parent
        width: control.glyphSize; height: width
        name: control.glyph
        visible: control.glyph !== ""
        color: control.lit ? root.skinAccent : root.skinText
      }
      Text {
        anchors.centerIn: parent
        text: control.text
        visible: control.glyph === ""
        textFormat: Text.PlainText
        color: control.lit ? root.skinAccent : root.skinText
        font.family: root.skinFontFamily
        font.pixelSize: Math.max(9, 11 * root.unit)
        font.bold: true
      }
    }
    QQC.ToolTip.visible: hovered && hint !== ""
    QQC.ToolTip.text: hint
    QQC.ToolTip.delay: 500
  }

  component TitleStrip: Item {
    id: strip
    property string caption: ""
    implicitHeight: 26 * root.unit
    Rectangle {
      anchors.fill: parent
      visible: root.skinSpec.title === "block"
      color: Util.alpha(root.skinAccent, 0.14)
      border.color: root.skinAccent
      border.width: root.unit
    }
    Rectangle {
      x: 6 * root.unit; anchors.verticalCenter: parent.verticalCenter
      width: parent.width - 12 * root.unit; height: root.unit
      visible: root.skinSpec.title === "line"
      color: root.skinBorder
    }
    Rectangle {
      anchors.centerIn: title
      width: title.implicitWidth + 22 * root.unit; height: 22 * root.unit
      visible: root.skinSpec.title === "pill"
      radius: height / 2
      color: Util.alpha(root.skinAccent, 0.12)
      border.color: root.skinAccent
      border.width: root.unit
    }
    Rectangle {
      x: 6 * root.unit; anchors.verticalCenter: parent.verticalCenter
      width: 4 * root.unit; height: 18 * root.unit
      visible: root.skinSpec.title === "offset"
      color: root.skinAccent
    }
    Row {
      anchors.centerIn: parent
      spacing: 5 * root.unit
      visible: root.skinSpec.title === "segments"
      Repeater {
        model: 9
        Rectangle {
          required property int index
          width: (index === 4 ? title.implicitWidth + 18 * root.unit : 18 * root.unit)
          height: 2 * root.unit
          color: index === 4 ? root.skinBackground : root.skinMuted
        }
      }
    }
    Rectangle { x: 6 * root.unit; width: Math.max(0, (parent.width - title.implicitWidth) / 2 - 18 * root.unit); y: parent.height / 2 - 3 * root.unit; height: root.unit; visible: root.skinSpec.title === "rails"; color: root.skinMuted }
    Rectangle { x: 6 * root.unit; width: Math.max(0, (parent.width - title.implicitWidth) / 2 - 18 * root.unit); y: parent.height / 2 + 3 * root.unit; height: root.unit; visible: root.skinSpec.title === "rails"; color: root.skinMuted }
    Rectangle { anchors.right: parent.right; anchors.rightMargin: 6 * root.unit; width: Math.max(0, (parent.width - title.implicitWidth) / 2 - 18 * root.unit); y: parent.height / 2 - 3 * root.unit; height: root.unit; visible: root.skinSpec.title === "rails"; color: root.skinMuted }
    Rectangle { anchors.right: parent.right; anchors.rightMargin: 6 * root.unit; width: Math.max(0, (parent.width - title.implicitWidth) / 2 - 18 * root.unit); y: parent.height / 2 + 3 * root.unit; height: root.unit; visible: root.skinSpec.title === "rails"; color: root.skinMuted }
    Text {
      id: title
      x: root.skinSpec.title === "offset" ? 18 * root.unit : (parent.width - width) / 2
      anchors.verticalCenter: parent.verticalCenter
      text: strip.caption
      color: root.skinText
      font.family: root.skinFontFamily
      font.pixelSize: Math.max(10, 12 * root.unit)
      font.bold: true
      font.letterSpacing: root.unit
    }
  }

  Rectangle {
    anchors.fill: parent
    color: root.skinBackground
    MouseArea { anchors.fill: parent; onClicked: {} }
  }

  Rectangle {
    id: card
    objectName: "radioCard"
    anchors.top: parent.top
    anchors.left: parent.left
    anchors.right: parent.right
    height: Math.min(parent.height, root.preferredHeight)
    color: root.skinBackground
    border.color: root.skinBorder
    border.width: root.skinBorderWidth
    radius: root.skinRadius
    gradient: Gradient {
      GradientStop { position: 0; color: root.skinSurfaceTop }
      GradientStop { position: 0.48; color: root.skinBackground }
      GradientStop { position: 1; color: root.skinSurfaceBottom }
    }

    Rectangle {
      anchors.fill: parent
      anchors.margins: 4 * root.unit
      radius: Math.max(0, root.skinRadius - 4 * root.unit)
      color: "transparent"
      border.width: root.unit
      border.color: root.skinSpec.bevel ? root.skinHighlight : root.skinBorder
      opacity: root.skinSpec.bevel ? 0.65 : 0.45
    }

    // Surface treatments use the active desktop palette, but each face has
    // its own material: brushed rack, orbital arcs, pedal grip, tape label,
    // open waveform, console divisions, and a valve receiver chassis.
    Canvas {
      anchors.fill: parent
      antialiasing: true
      property int design: root.normalizedSkin
      property color ink: root.skinBorder
      property color shadow: root.skinShadow
      onDesignChanged: requestPaint()
      onInkChanged: requestPaint()
      onShadowChanged: requestPaint()
      onWidthChanged: requestPaint()
      onHeightChanged: requestPaint()
      onPaint: {
        var c = getContext("2d")
        c.reset()
        c.scale(width / 550, root.unit)
        c.strokeStyle = String(ink)
        c.fillStyle = String(ink)
        c.lineWidth = 1
        c.globalAlpha = 0.65
        if (design === 1) {
          for (var y = 35; y < 225; y += 5) c.fillRect(11, y, 528, 0.5)
          c.fillRect(9, 34, 2, 188); c.fillRect(539, 34, 2, 188)
          c.strokeRect(14, 160, 522, 12)
        } else if (design === 2) {
          for (var r = 78; r <= 94; r += 8) {
            c.beginPath(); c.arc(109, 107, r, -0.78, 0.78); c.stroke()
            c.beginPath(); c.arc(109, 107, r, Math.PI - 0.78, Math.PI + 0.78); c.stroke()
          }
          for (var notch = 0; notch < 24; notch++) {
            var angle = notch * Math.PI / 12
            c.beginPath()
            c.moveTo(109 + Math.cos(angle) * 72, 107 + Math.sin(angle) * 72)
            c.lineTo(109 + Math.cos(angle) * 75, 107 + Math.sin(angle) * 75)
            c.stroke()
          }
        } else if (design === 3) {
          c.fillStyle = String(shadow)
          c.fillRect(20, 246, 292, 16)
          c.fillStyle = String(ink)
          for (var grip = 0; grip < 4; grip++) c.fillRect(24, 249 + grip * 3, 284, 1)
          c.fillRect(326, 42, 2, 224)
          c.strokeRect(20, 246, 292, 16)
        } else if (design === 4) {
          c.fillRect(22, 37, 234, 18)
          for (var stripe = 0; stripe < 3; stripe++) c.fillRect(24, 177 + stripe * 3, 230, 1)
          for (var rib = 0; rib < 10; rib++) c.fillRect(105 + rib * 7, 157, 3, 10)
        } else if (design === 5) {
          c.globalAlpha = 0.8
          c.beginPath(); c.moveTo(28, 135); c.lineTo(522, 135); c.stroke()
          for (var dash = 0; dash <= 20; dash++) c.fillRect(28 + dash * 24.7, 141, 1, dash % 5 === 0 ? 5 : 2)
        } else if (design === 6) {
          c.fillRect(302, 40, 1, 178)
          for (var vent = 0; vent < 12; vent++) c.fillRect(22 + vent * 14, 224, 8, 2)
          c.strokeRect(308, 38, 224, 120)
        } else {
          // Folded receiver chassis with paired trim rails and ventilation slots.
          c.globalAlpha = 0.22
          for (var grain = 38; grain < 307; grain += 2)
            c.fillRect(12, grain, 526, 0.35)
          c.globalAlpha = 0.7
          c.fillRect(9, 40, 1, 272); c.fillRect(540, 40, 1, 272)
          c.fillRect(12, 40, 0.5, 272); c.fillRect(537, 40, 0.5, 272)
          for (var vent = 0; vent < 13; vent++) {
            c.fillStyle = String(shadow)
            c.fillRect(353 + vent * 14, 223, 8, 2)
            c.fillStyle = String(ink)
            c.fillRect(353 + vent * 14, 225, 8, 0.5)
          }
          c.fillRect(16, 306, 518, 0.5)
        }
      }
    }

    Item {
      id: mainHeader
      // Rounded skins need clearance from the curved top corners.
      readonly property real sideInset: root.normalizedSkin === 2 || root.normalizedSkin === 5 || root.normalizedSkin === 7 ? 18 * root.unit : 4 * root.unit
      x: sideInset; y: 2 * root.unit
      width: parent.width - 2 * sideInset; height: 26 * root.unit
      RomanCrossIcon { x: 5 * root.unit; anchors.verticalCenter: parent.verticalCenter; width: 16 * root.unit; height: 18 * root.unit; color: "#ffffff" }
      TitleStrip { x: 25 * root.unit; width: parent.width - 56 * root.unit; height: parent.height; caption: I18n.t(root.appLanguage, "radioTitle").toUpperCase() + " · " + root.skinSpec.name.toUpperCase() }
      QQC.AbstractButton {
        id: radioCloseButton
        objectName: "radioClose"
        anchors.right: parent.right; anchors.verticalCenter: parent.verticalCenter
        width: 20 * root.unit; height: 20 * root.unit
        focusPolicy: Qt.StrongFocus
        Accessible.name: I18n.t(root.appLanguage, "closeRadio")
        QQC.ToolTip.visible: hovered
        QQC.ToolTip.text: Accessible.name
        QQC.ToolTip.delay: 350
        background: Rectangle {
          radius: Math.min(root.skinRadius, 3 * root.unit)
          color: radioCloseButton.down || radioCloseButton.hovered ? root.skinHover : root.skinInset
          border.width: root.unit
          border.color: radioCloseButton.activeFocus ? root.skinAccent : root.skinBorder
        }
        contentItem: Item {
          PixelIcon {
            anchors.centerIn: parent
            width: Style.space(14)
            height: width
            name: "close"
            color: radioCloseButton.activeFocus ? root.skinAccent : root.skinText
          }
        }
        onClicked: root.close()
      }
    }

    Rectangle { x: 2 * root.unit; y: mainHeader.y + mainHeader.height; width: parent.width - 4 * root.unit; height: 2 * root.unit; color: root.skinBorder }

    Canvas {
      id: skinArtwork
      objectName: "radioSkinArtwork"
      antialiasing: true
      x: 0; y: 32 * root.unit
      width: parent.width; height: 240 * root.unit
      property int design: root.normalizedSkin
      property color accentInk: root.skinAccent
      property color mutedInk: root.skinBorder
      property color surfaceInk: root.skinInset
      property color highlightInk: root.skinHighlight
      property color shadowInk: root.skinShadow
      // Mechanical motion is timed; waveforms and meters use decoded PCM.
      property real scratchAngle: 0
      onScratchAngleChanged: requestPaint()
      property real motionTime: 0
      property real responseLevel: 0
      property var responseWaveform: []
      property var speakerRipples: []
      property real rippleClock: 1
      readonly property bool animating: root.playing && !root.buffering && root.visible
      onMotionTimeChanged: requestPaint()
      onAnimatingChanged: {
        if (!animating) resetResponse()
        requestPaint()
      }
      Timer {
        interval: 33
        repeat: true
        running: skinArtwork.animating
        onTriggered: {
          if (!audioTap.scratching) skinArtwork.motionTime += 0.033
          skinArtwork.advanceResponse(0.033,
            Math.max(Number(audioTap.levels[0] || 0), Number(audioTap.levels[1] || 0)),
            audioTap.waveform)
        }
      }
      onDesignChanged: { resetResponse(); requestPaint() }
      onAccentInkChanged: requestPaint()
      onMutedInkChanged: requestPaint()
      onSurfaceInkChanged: requestPaint()
      onHighlightInkChanged: requestPaint()
      onShadowInkChanged: requestPaint()
      onWidthChanged: requestPaint()
      onHeightChanged: requestPaint()
      function meterLevel(rms) {
        // Map -48 dBFS through 0 dBFS onto the face of each meter.
        return rms > 0 ? Math.max(0, Math.min(1, (20 * Math.log(rms) / Math.LN10 + 48) / 48)) : 0
      }
      function audioAmplitude(value, boost) {
        // A gentle power curve reveals quiet passages without making silence move.
        return isFinite(value) && value > 0
          ? Math.min(1, Math.pow(Math.min(1, value), 0.65) * boost) : 0
      }
      function resetResponse() {
        responseLevel = 0
        responseWaveform = []
        speakerRipples = []
        rippleClock = 1
      }
      function advanceResponse(seconds, rms, peaks) {
        var target = audioAmplitude(rms, 1.8)
        var previous = responseLevel
        var follow = 1 - Math.exp(-seconds / (target > previous ? 0.025 : 0.14))
        responseLevel = previous + (target - previous) * follow
        if (responseLevel < 0.0005) responseLevel = 0
        var peakCeiling = 0
        var peakFloor = 1
        for (var bin = 0; bin < 65; bin++) {
          var peak = Math.max(0, Math.min(1, Number(peaks[bin] || 0)))
          peakCeiling = Math.max(peakCeiling, peak)
          peakFloor = Math.min(peakFloor, peak)
        }
        // Enhance the measured contour within each buffer, then scale the
        // whole trace by its actual peak loudness (including output volume).
        var waveGain = audioAmplitude(peakCeiling, 1.35)
        var floor = peakFloor * 0.92
        var samples = []
        for (var sample = 0; sample < 65; sample++) {
          var raw = Math.max(0, Math.min(1, Number(peaks[sample] || 0)))
          var detail = peakCeiling > 0
            ? 0.25 * raw / peakCeiling + 0.75 * (raw - floor) / (peakCeiling - floor) : 0
          var next = waveGain * Math.max(0, Math.min(1, detail))
          var last = Number(responseWaveform[sample] || 0)
          var blend = 1 - Math.exp(-seconds / (next > last ? 0.012 : 0.035))
          var value = last + (next - last) * blend
          samples.push(value < 0.0005 ? 0 : value)
        }
        responseWaveform = samples

        // Each ring carries the loudness of the sound that launched it.
        // Only travel is time based; silent PCM never launches a ring.
        var ripples = []
        for (var index = 0; index < speakerRipples.length; index++) {
          var ripple = speakerRipples[index]
          if (ripple.age + seconds < 0.85)
            ripples.push({ age: ripple.age + seconds, strength: ripple.strength })
        }
        rippleClock += seconds
        if (design === 3 && target > 0.025
            && (rippleClock >= 0.28 - responseLevel * 0.12
                || (target - previous > 0.12 && rippleClock >= 0.09))) {
          ripples.push({ age: 0, strength: responseLevel })
          rippleClock = 0
        }
        speakerRipples = ripples
        requestPaint()
      }
      onPaint: {
        var c = getContext("2d")
        c.reset()
        c.scale(width / 550, root.unit)
        function line(x1, y1, x2, y2, ink, thickness) {
          c.strokeStyle = String(ink); c.lineWidth = thickness || 1
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke()
        }
        function ring(x, y, r, ink, thickness) {
          c.strokeStyle = String(ink); c.lineWidth = thickness || 1
          c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke()
        }
        function box(x, y, w, h, ink) {
          c.fillStyle = ink; c.fillRect(x, y, w, h)
        }
        function fastener(x, y, radius) {
          c.fillStyle = String(shadowInk)
          c.beginPath(); c.arc(x, y + 1, radius + 1, 0, Math.PI * 2); c.fill()
          ring(x, y, radius, highlightInk)
          ring(x, y, radius - 1, mutedInk)
          line(x - radius * 0.5, y + radius * 0.3,
               x + radius * 0.5, y - radius * 0.3, shadowInk, 1.5)
        }
        if (design === 1) {
          for (var screw = 0; screw < 4; screw++) {
            var sx = screw % 2 ? 543 : 7
            var sy = screw < 2 ? 12 : 187
            fastener(sx, sy, 3)
          }
          // Recessed meter rail with individual glass segments.
          box(16, 129, 518, 9, shadowInk)
          line(16, 138, 534, 138, highlightInk)
          for (var led = 0; led < 48; led++) {
            var illuminated = led < 48 * skinArtwork.meterLevel(Math.max(audioTap.levels[0], audioTap.levels[1]))
            box(18 + led * 10.7, 132, 7, 3, illuminated ? accentInk : mutedInk)
            if (illuminated) {
              c.globalAlpha = 0.2
              box(17 + led * 10.7, 130, 9, 7, accentInk)
              c.globalAlpha = 1
            }
          }
        } else if (design === 2) {
          var orbitAngle = motionTime * 1.8 + scratchAngle
          var vinyl = c.createRadialGradient(99, 62, 5, 109, 75, 67)
          vinyl.addColorStop(0, String(surfaceInk))
          vinyl.addColorStop(0.7, String(shadowInk))
          vinyl.addColorStop(1, String(surfaceInk))
          c.fillStyle = vinyl
          c.beginPath(); c.arc(109, 75, 66, 0, Math.PI * 2); c.fill()
          ring(109, 75, 68, shadowInk, 4)
          ring(109, 75, 66, highlightInk, 2)
          c.globalAlpha = 0.45
          for (var groove = 0; groove < 9; groove++) {
            ring(109, 75, 62 - groove * 5, mutedInk)
            ring(109, 75, 60 - groove * 5, shadowInk)
          }
          // A restrained vinyl reflection travels with the record.
          c.strokeStyle = String(highlightInk); c.lineWidth = 7
          c.globalAlpha = 0.12
          for (var sheen = 0; sheen < 2; sheen++) {
            c.beginPath()
            c.arc(109, 75, 56, orbitAngle + sheen * Math.PI,
                  orbitAngle + sheen * Math.PI + 0.5)
            c.stroke()
          }
          c.globalAlpha = 1
          // The closed waveform and its inner echo share the record's rotation.
          // The seam averages its two end samples so it cannot develop a spike.
          var orbitSamples = []
          for (var orbitSample = 0; orbitSample < 64; orbitSample++)
            orbitSamples.push(Number(responseWaveform[orbitSample] || 0))
          orbitSamples[0] = (orbitSamples[0] + Number(responseWaveform[64] || 0)) / 2
          c.beginPath()
          for (var edge = 0; edge < 2; edge++) {
            for (var point = 0; point <= 64; point++) {
              var bin = (edge === 0 ? point : 64 - point) % 64
              var theta = bin * Math.PI / 32 + orbitAngle
              var radius = 43 + orbitSamples[bin] * (edge === 0 ? 16 : -11)
              var px = 109 + Math.cos(theta) * radius
              var py = 75 + Math.sin(theta) * radius
              if (edge === 0 && point === 0) c.moveTo(px, py)
              else c.lineTo(px, py)
            }
          }
          c.closePath()
          c.fillStyle = String(accentInk); c.globalAlpha = 0.16
          c.fill()
          for (var echo = 0; echo < 2; echo++) {
            c.beginPath()
            for (var trace = 0; trace <= 64; trace++) {
              var traceBin = trace % 64
              var traceAngle = traceBin * Math.PI / 32 + orbitAngle
              var traceRadius = 43 + orbitSamples[traceBin] * (echo === 0 ? 16 : -11)
              var tx = 109 + Math.cos(traceAngle) * traceRadius
              var ty = 75 + Math.sin(traceAngle) * traceRadius
              if (trace === 0) c.moveTo(tx, ty)
              else c.lineTo(tx, ty)
            }
            c.closePath()
            c.globalAlpha = echo === 0 ? 0.35 + responseLevel * 0.65 : 0.15 + responseLevel * 0.3
            c.strokeStyle = String(accentInk); c.lineWidth = echo === 0 ? 1.8 : 1
            c.stroke()
          }
          c.globalAlpha = 1
          c.fillStyle = String(surfaceInk)
          c.beginPath(); c.arc(109, 75, 24, 0, Math.PI * 2); c.fill()
          ring(109, 75, 23, accentInk, 1.5)
          ring(109, 75, 20, mutedInk)
          ring(109, 75, 5, shadowInk, 4)
          ring(109, 75, 3, highlightInk, 1.5)
          line(109 + Math.cos(orbitAngle) * 12, 75 + Math.sin(orbitAngle) * 12,
               109 + Math.cos(orbitAngle) * 19, 75 + Math.sin(orbitAngle) * 19, accentInk, 2)
          // Machined platter rim rotates beneath the stationary tonearm.
          for (var strobe = 0; strobe < 48; strobe++) {
            var strobeAngle = strobe * Math.PI / 24 + orbitAngle
            line(109 + Math.cos(strobeAngle) * 69, 75 + Math.sin(strobeAngle) * 69,
                 109 + Math.cos(strobeAngle) * 71, 75 + Math.sin(strobeAngle) * 71,
                 strobe % 4 === 0 ? highlightInk : mutedInk)
          }
          fastener(170, 18, 5)
          line(173, 20, 173, 67, shadowInk, 4); line(173, 67, 146, 100, shadowInk, 4)
          line(170, 18, 170, 65, mutedInk, 3); line(170, 65, 143, 98, mutedInk, 3)
          line(172, 20, 172, 65, highlightInk)
          box(138, 96, 10, 6, accentInk)
          line(138, 96, 148, 96, highlightInk)
        } else if (design === 3) {
          box(334, 110, 200, 128, surfaceInk)
          line(335, 111, 533, 111, shadowInk, 2)
          line(335, 237, 533, 237, highlightInk)
          var halo = c.createRadialGradient(434, 174, 33, 434, 174, 63)
          halo.addColorStop(0, String(Util.alpha(accentInk, responseLevel * 0.25)))
          halo.addColorStop(1, String(Util.alpha(accentInk, 0)))
          c.fillStyle = halo
          c.fillRect(371, 111, 126, 126)
          // The surround stays bolted down while the cone and dust cap flex.
          c.fillStyle = String(shadowInk)
          c.beginPath(); c.arc(434, 174, 44, 0, Math.PI * 2); c.fill()
          ring(434, 174, 43, mutedInk, 5)
          ring(434, 174, 40, highlightInk, 1.5)
          var coneRadius = 25 + responseLevel * 12
          var cone = c.createRadialGradient(430, 166, 3, 434, 174, coneRadius)
          cone.addColorStop(0, String(highlightInk))
          cone.addColorStop(0.35, String(surfaceInk))
          cone.addColorStop(0.8, String(mutedInk))
          cone.addColorStop(1, String(shadowInk))
          c.fillStyle = cone
          c.beginPath(); c.arc(434, 174, coneRadius, 0, Math.PI * 2); c.fill()
          ring(434, 174, coneRadius, accentInk, 1.5 + responseLevel)
          ring(434, 174, coneRadius - 4, shadowInk, 1.5)
          var capY = 174 - responseLevel * 3
          var capRadius = 10 + responseLevel * 5
          var cap = c.createRadialGradient(431, capY - 4, 1, 434, capY, capRadius)
          cap.addColorStop(0, String(highlightInk))
          cap.addColorStop(0.5, String(mutedInk))
          cap.addColorStop(1, String(shadowInk))
          c.fillStyle = cap
          c.beginPath(); c.arc(434, capY, capRadius, 0, Math.PI * 2); c.fill()
          ring(434, capY, capRadius, mutedInk)
          for (var knurl = 0; knurl < 48; knurl++) {
            var knurlAngle = knurl * Math.PI / 24
            line(434 + Math.cos(knurlAngle) * 41, 174 + Math.sin(knurlAngle) * 41,
                 434 + Math.cos(knurlAngle) * 44, 174 + Math.sin(knurlAngle) * 44,
                 knurl % 3 === 0 ? highlightInk : shadowInk)
          }
          for (var pulse = 0; pulse < speakerRipples.length; pulse++) {
            var progress = speakerRipples[pulse].age / 0.85
            var strength = speakerRipples[pulse].strength
            var origin = 30 + strength * 8
            c.globalAlpha = Math.min(1, strength * 1.45) * Math.pow(1 - progress, 1.1)
            ring(434, 174, origin + progress * (62 - origin), accentInk, 2.8 - progress * 1.8)
          }
          c.globalAlpha = 1
          for (var bolt = 0; bolt < 4; bolt++)
            fastener(345 + (bolt % 2) * 178, bolt < 2 ? 121 : 227, 3)
        } else if (design === 4) {
          box(16, 8, 246, 140, surfaceInk)
          c.strokeStyle = String(mutedInk); c.lineWidth = 2; c.strokeRect(22, 14, 234, 128)
          line(24, 16, 254, 16, highlightInk, 2)
          line(24, 140, 254, 140, shadowInk, 3)
          box(36, 22, 206, 103, shadowInk)
          line(37, 23, 241, 23, mutedInk)
          // Compact reels leave a dedicated window above the horizontal tape.
          for (var reel = 0; reel < 2; reel++) {
            var rx = 76 + reel * 126
            c.fillStyle = String(surfaceInk)
            c.beginPath(); c.arc(rx, 53, 32, 0, Math.PI * 2); c.fill()
            ring(rx, 53, 32, mutedInk, 2)
            ring(rx, 53, 30, highlightInk)
            for (var winding = 0; winding < 5; winding++)
              ring(rx, 53, 23 + winding * 1.4, winding % 2 ? shadowInk : mutedInk, 0.7)
            ring(rx, 53, 20, accentInk, 1.5)
            for (var spoke = 0; spoke < 3; spoke++) {
              var angle = spoke * Math.PI * 2 / 3 + motionTime * (reel === 0 ? 1.7 : 1.9)
              c.strokeStyle = String(mutedInk); c.lineWidth = 6
              c.beginPath(); c.arc(rx, 53, 14, angle, angle + 0.65); c.stroke()
              c.strokeStyle = String(highlightInk); c.lineWidth = 1
              c.beginPath(); c.arc(rx, 53, 17, angle, angle + 0.65); c.stroke()
            }
            ring(rx, 53, 7, shadowInk, 3)
            ring(rx, 53, 4, highlightInk)
          }
          line(76, 85, 58, 120, mutedInk, 1.5)
          line(202, 85, 220, 120, mutedInk, 1.5)
          // Live sample peaks rise from the tape itself, never below it.
          if (responseLevel > 0) {
            var tapeGlow = c.createLinearGradient(0, 86, 0, 120)
            tapeGlow.addColorStop(0, String(Util.alpha(accentInk, 0.24)))
            tapeGlow.addColorStop(1, String(Util.alpha(accentInk, 0.04)))
            c.beginPath(); c.moveTo(61, 120)
            for (var tapeSample = 0; tapeSample < 65; tapeSample++)
              c.lineTo(61 + tapeSample * 156 / 64,
                120 - Number(responseWaveform[tapeSample] || 0) * 33)
            c.lineTo(217, 120); c.closePath()
            c.fillStyle = tapeGlow; c.fill()
            for (var tapeBar = 0; tapeBar < 65; tapeBar++) {
              var tapeHeight = Number(responseWaveform[tapeBar] || 0) * 33
              c.globalAlpha = 0.25 + responseLevel * 0.5
              line(61 + tapeBar * 156 / 64, 119,
                   61 + tapeBar * 156 / 64, 120 - tapeHeight, accentInk, 1)
            }
            c.globalAlpha = 0.5 + responseLevel * 0.5
            c.beginPath()
            for (var crest = 0; crest < 65; crest++) {
              var crestX = 61 + crest * 156 / 64
              var crestY = 120 - Number(responseWaveform[crest] || 0) * 33
              if (crest === 0) c.moveTo(crestX, crestY)
              else c.lineTo(crestX, crestY)
            }
            c.strokeStyle = String(accentInk); c.lineWidth = 1.5; c.stroke()
            c.globalAlpha = 1
          }
          line(58, 120, 220, 120, accentInk, 1.5)
          ring(58, 120, 3, highlightInk); ring(220, 120, 3, highlightInk)
          box(118, 125, 42, 11, shadowInk)
          box(124, 126, 30, 6, mutedInk)
          line(124, 126, 154, 126, highlightInk)
          for (var tapeHead = 0; tapeHead < 3; tapeHead++)
            line(130 + tapeHead * 9, 127, 130 + tapeHead * 9, 132, shadowInk)
          line(98, 135, 110, 125, mutedInk, 2); line(168, 125, 180, 135, mutedInk, 2)
          for (var fastenerIndex = 0; fastenerIndex < 4; fastenerIndex++) {
            var fx = fastenerIndex % 2 ? 248 : 30
            var fy = fastenerIndex < 2 ? 22 : 134
            fastener(fx, fy, 2)
          }
        } else if (design === 5) {
          c.globalAlpha = 0.18
          for (var grid = 0; grid < 5; grid++)
            line(24, 79 + grid * 10, 528, 79 + grid * 10, mutedInk)
          c.globalAlpha = 1
          line(24, 76, 24, 122, highlightInk)
          line(528, 76, 528, 122, highlightInk)
          for (var wave = 0; wave < 65; wave++) {
            var amplitude = Math.max(1, 48 * Number(audioTap.waveform[wave] || 0))
            line(25 + wave * 7.8, 99 - amplitude / 2, 25 + wave * 7.8, 99 + amplitude / 2,
                 wave % 4 === 0 ? accentInk : mutedInk, 2)
          }
        } else if (design === 6) {
          for (var meter = 0; meter < 2; meter++) {
            var mx = 358 + meter * 116
            var meterRadius = 44
            var needleRadius = 40
            box(mx - 48, 8, 102, 116, surfaceInk)
            c.strokeStyle = String(mutedInk); c.lineWidth = 2
            c.strokeRect(mx - 48, 8, 102, 116)
            line(mx - 45, 11, mx + 51, 11, shadowInk, 3)
            line(mx - 45, 121, mx + 51, 121, highlightInk)
            // Keep every moving stroke inside its own instrument housing.
            c.save()
            c.beginPath(); c.rect(mx - 44, 14, 94, 105); c.clip()
            c.strokeStyle = String(mutedInk); c.lineWidth = 2
            c.beginPath(); c.arc(mx, 98, meterRadius, Math.PI * 1.15, Math.PI * 1.85); c.stroke()
            c.globalAlpha = 0.25
            c.lineWidth = 5
            c.strokeStyle = String(accentInk)
            c.beginPath(); c.arc(mx, 98, meterRadius - 3, Math.PI * 1.72, Math.PI * 1.85); c.stroke()
            c.globalAlpha = 1
            for (var tick = 0; tick < 9; tick++) {
              var a = Math.PI * (1.15 + tick * 0.7 / 8)
              line(mx + Math.cos(a) * (meterRadius - 6), 98 + Math.sin(a) * (meterRadius - 6),
                   mx + Math.cos(a) * meterRadius, 98 + Math.sin(a) * meterRadius, tick >= 7 ? accentInk : mutedInk, 2)
            }
            c.fillStyle = String(mutedInk)
            c.font = "8px monospace"
            c.fillText("−20   0  +3", mx - 32, 38)
            var level = skinArtwork.meterLevel(Number(audioTap.levels[meter] || 0))
            var needleAngle = Math.PI * (1.15 + level * 0.7)
            line(mx, 98, mx + Math.cos(needleAngle) * needleRadius,
                 98 + Math.sin(needleAngle) * needleRadius, accentInk, 2)
            ring(mx, 98, 5, accentInk, 2)
            ring(mx, 98, 2, highlightInk)
            c.fillStyle = String(accentInk)
            c.font = "9px monospace"
            c.fillText(meter === 0 ? "L / VU" : "R / VU", mx - 20, 116)
            c.restore()
          }
        } else {
          // Three glass valves on a cast-metal plinth. Filaments and their
          // reflected light follow measured PCM, including quiet passages.
          var chassis = c.createLinearGradient(0, 171, 0, 193)
          chassis.addColorStop(0, String(highlightInk))
          chassis.addColorStop(0.12, String(root.skinRaised))
          chassis.addColorStop(0.55, String(surfaceInk))
          chassis.addColorStop(1, String(shadowInk))
          box(20, 173, 312, 21, shadowInk)
          box(18, 171, 314, 19, chassis)
          line(20, 171, 329, 171, highlightInk, 0.8)
          fastener(25, 182, 2.5); fastener(325, 182, 2.5)

          for (var valve = 0; valve < 3; valve++) {
            var vx = 74 + valve * 101
            var crown = valve === 1 ? 92 : 101
            var strength = Math.min(1, responseLevel * 0.55
              + Number(responseWaveform[12 + valve * 20] || 0) * 0.7)
            // Soft pools of light sit behind the glass rather than obscuring it.
            var halo = c.createRadialGradient(vx, 147, 2, vx, 147, 55)
            halo.addColorStop(0, String(Util.alpha(accentInk, 0.1 + strength * 0.25)))
            halo.addColorStop(1, String(Util.alpha(accentInk, 0)))
            box(vx - 55, 91, 110, 106, halo)
            c.fillStyle = String(shadowInk)
            c.beginPath(); c.ellipse(vx - 38, 175, 76, 10); c.fill()

            // Rounded envelope, thick glass lip, and a darker edge for depth.
            c.beginPath(); c.moveTo(vx - 29, 170)
            c.lineTo(vx - 29, crown + 23)
            c.bezierCurveTo(vx - 29, crown - 4, vx + 29, crown - 4, vx + 29, crown + 23)
            c.lineTo(vx + 29, 170); c.closePath()
            var glass = c.createLinearGradient(vx - 30, 0, vx + 30, 0)
            glass.addColorStop(0, String(root.skinRaised))
            glass.addColorStop(0.12, String(Util.alpha(highlightInk, 0.38)))
            glass.addColorStop(0.3, String(Util.alpha(surfaceInk, 0.7)))
            glass.addColorStop(0.76, String(Util.alpha(shadowInk, 0.8)))
            glass.addColorStop(1, String(root.skinRaised))
            c.fillStyle = glass; c.fill()
            c.strokeStyle = String(highlightInk); c.lineWidth = 0.8; c.stroke()
            c.save(); c.clip()

            // Ribbed anode plates and their fine support rods are visible inside.
            box(vx - 17, crown + 23, 34, 44, shadowInk)
            var plate = c.createLinearGradient(vx - 16, 0, vx + 16, 0)
            plate.addColorStop(0, String(mutedInk))
            plate.addColorStop(0.4, String(root.skinRaised))
            plate.addColorStop(1, String(surfaceInk))
            box(vx - 16, crown + 24, 32, 42, plate)
            for (var rib = 0; rib < 7; rib++) {
              line(vx - 15, crown + 27 + rib * 5, vx + 15, crown + 27 + rib * 5, shadowInk, 1.5)
              line(vx - 15, crown + 28 + rib * 5, vx + 15, crown + 28 + rib * 5, highlightInk, 0.35)
            }
            line(vx - 9, crown + 18, vx - 9, 173, mutedInk, 1)
            line(vx + 9, crown + 18, vx + 9, 173, mutedInk, 1)
            var filament = c.createRadialGradient(vx, 153, 0, vx, 153, 31)
            filament.addColorStop(0, String(Util.alpha(accentInk, 0.2 + strength * 0.6)))
            filament.addColorStop(1, String(Util.alpha(accentInk, 0)))
            box(vx - 32, 121, 64, 62, filament)
            // A coiled filament brightens and blooms with the audio level.
            for (var glow = 2; glow >= 0; glow--) {
              c.beginPath(); c.moveTo(vx - 6, 168)
              for (var coil = 0; coil < 10; coil++)
                c.lineTo(vx + (coil % 2 ? 6 : -6), 165 - coil * 3.3)
              c.strokeStyle = String(glow === 0 ? Qt.tint(accentInk, Util.alpha(root.skinText, strength * 0.65)) : accentInk)
              c.globalAlpha = glow === 0 ? 0.35 + strength * 0.65 : strength * 0.14
              c.lineWidth = glow === 0 ? 1.3 : 3 + glow * 3
              c.stroke()
            }
            c.globalAlpha = 1
            // Curved highlights catch the envelope's shoulder and side.
            c.beginPath(); c.moveTo(vx - 22, 155); c.lineTo(vx - 22, crown + 25)
            c.quadraticCurveTo(vx - 22, crown + 8, vx - 5, crown + 7)
            c.strokeStyle = String(Util.alpha(root.skinText, 0.42)); c.lineWidth = 2; c.stroke()
            line(vx + 24, crown + 30, vx + 24, 161, highlightInk, 0.7)
            c.restore()

            // Ceramic socket and polished retaining rings.
            box(vx - 33, 168, 66, 11, shadowInk)
            for (var band = 0; band < 3; band++) {
              box(vx - 33, 168 + band * 4, 66, 2, mutedInk)
              line(vx - 31, 168 + band * 4, vx + 31, 168 + band * 4, highlightInk, 0.65)
            }
            for (var knurl = 0; knurl < 17; knurl++)
              line(vx - 30 + knurl * 3.8, 169, vx - 30 + knurl * 3.8, 178, shadowInk, 0.7)
            c.font = "7px monospace"; c.textAlign = "center"
            c.fillStyle = String(highlightInk)
            c.fillText(["ECC 83", "EL 84", "ECC 83"][valve], vx, 187)
            c.textAlign = "left"
          }

          // An illuminated signal scale balances the transport keys.
          box(350, 203, 184, 33, shadowInk)
          box(352, 205, 180, 29, surfaceInk)
          line(352, 205, 532, 205, mutedInk, 0.6)
          c.fillStyle = String(highlightInk); c.font = "7px monospace"
          c.fillText("SIGNAL", 359, 215)
          for (var tick = 0; tick <= 24; tick++) {
            var tickX = 359 + tick * 6.8
            line(tickX, 230, tickX, tick % 4 === 0 ? 219 : 225, mutedInk, 0.7)
          }
          var needle = 359 + responseLevel * 163.2
          box(needle - 2, 216, 4, 16, Util.alpha(accentInk, 0.16))
          line(needle, 216, needle, 232, accentInk, 1.5)
          line(352, 234, 532, 234, highlightInk, 0.5)

        }
      }
    }

    MouseArea {
      id: recordGesture
      objectName: "radioOrbitRecord"
      x: root.designX(41); y: 39 * root.unit
      width: root.designX(136); height: 136 * root.unit
      visible: root.normalizedSkin === 2
      enabled: visible && root.playing && !root.buffering
      acceptedButtons: Qt.LeftButton
      preventStealing: true
      property real previousAngle: 0
      property double previousTime: 0
      function angleAt(px, py) {
        return Math.atan2((py / height - 0.5), (px / width - 0.5))
      }
      function releaseRecord() { audioTap.endScratch() }
      onPressed: function(mouse) {
        var dx = mouse.x / width - 0.5
        var dy = mouse.y / height - 0.5
        if (dx * dx + dy * dy > 0.25 || !audioTap.beginScratch()) {
          mouse.accepted = false
          return
        }
        previousAngle = angleAt(mouse.x, mouse.y)
        previousTime = Date.now()
      }
      onPositionChanged: function(mouse) {
        if (!pressed || !audioTap.scratching) return
        var angle = angleAt(mouse.x, mouse.y)
        var delta = angle - previousAngle
        if (delta > Math.PI) delta -= 2 * Math.PI
        if (delta < -Math.PI) delta += 2 * Math.PI
        var now = Date.now()
        audioTap.moveScratch(delta, (now - previousTime) / 1000)
        skinArtwork.scratchAngle += delta
        previousAngle = angle
        previousTime = now
      }
      onReleased: releaseRecord()
      onCanceled: releaseRecord()
      onEnabledChanged: if (!enabled) releaseRecord()
      Component.onDestruction: releaseRecord()
    }

    Item {
      id: displays
      width: parent.width; height: 270 * root.unit
      Rectangle {
        id: timerDisplay
        x: root.designX(root.skinSpec.timer[0]); y: root.skinSpec.timer[1] * root.unit
        width: root.designX(root.skinSpec.timer[2]); height: root.skinSpec.timer[3] * root.unit
        color: root.skinInset; border.color: root.skinBorder; border.width: root.skinBorderWidth
        radius: Math.min(root.skinRadius, height / 2)
        DisplayRim { }
        PixelIcon { x: 12 * root.unit; y: 15 * root.unit; width: 17 * root.unit; height: width; name: root.playing ? "play" : (root.paused ? "pause" : "stop"); color: root.skinAccent }
        Canvas {
          id: clockDisplay
          visible: root.normalizedSkin === 1 || root.normalizedSkin === 4
          x: 36 * root.unit; y: 12 * root.unit
          width: parent.width - 47 * root.unit; height: 35 * root.unit
          property string readout: root.elapsedText
          property color ink: root.skinAccent
          property color dimInk: Qt.tint(root.skinInset, Util.alpha(root.skinAccent, 0.1))
          onInkChanged: requestPaint()
          onDimInkChanged: requestPaint()
          onReadoutChanged: requestPaint()
          onWidthChanged: requestPaint()
          onHeightChanged: requestPaint()
          onPaint: {
            var c = getContext("2d")
            c.clearRect(0, 0, width, height)
            c.save()
            c.scale(width / 128, height / 34)
            var segments = [63,6,91,79,102,109,125,7,127,111]
            var positions = [[3,0,16,3],[19,3,3,12],[19,18,3,12],[3,30,16,3],[0,18,3,12],[0,3,3,12],[3,15,16,3]]
            var offset = 0
            for (var i = 0; i < readout.length; i++) {
              if (readout[i] === ":") {
                c.fillStyle = String(ink)
                c.fillRect(offset + 2,8,3,3); c.fillRect(offset + 2,23,3,3)
                offset += 12
              } else {
                for (var j = 0; j < 7; j++) {
                  c.fillStyle = segments[Number(readout[i])] & (1 << j) ? String(ink) : String(dimInk)
                  var p = positions[j]
                  c.fillRect(offset+p[0],p[1],p[2],p[3])
                }
                offset += 29
              }
            }
            c.restore()
          }
        }
        Text {
          visible: !clockDisplay.visible
          x: 36 * root.unit; y: 8 * root.unit
          width: parent.width - 47 * root.unit; height: 43 * root.unit
          text: root.elapsedText
          color: root.skinAccent
          font.family: Style.font.family
          font.pixelSize: 32 * root.unit
          font.weight: Font.DemiBold
          fontSizeMode: Text.Fit
          minimumPixelSize: 12
          verticalAlignment: Text.AlignVCenter
        }
        Text {
          x: 12 * root.unit; y: 57 * root.unit
          width: parent.width - 24 * root.unit
          text: root.playbackLabel.toUpperCase()
          color: root.playing || root.buffering ? root.skinAccent : root.skinMuted
          font.family: root.skinFontFamily; font.pixelSize: Math.max(10, 11 * root.unit); font.letterSpacing: root.unit
          elide: Text.ElideRight
        }
      }
      Rectangle {
        objectName: "radioStationDisplay"
        x: root.designX(root.skinSpec.station[0]); y: root.skinSpec.station[1] * root.unit
        width: root.designX(root.skinSpec.station[2]); height: root.skinSpec.station[3] * root.unit
        color: root.normalizedSkin === 5 ? "transparent" : root.skinInset
        border.color: root.skinBorder; border.width: root.normalizedSkin === 5 ? 0 : root.skinBorderWidth
        radius: Math.min(root.skinRadius, height / 2)
        DisplayRim { visible: root.normalizedSkin !== 5 }
        Item {
          id: stationTicker
          x: 9 * root.unit; y: 7 * root.unit
          width: parent.width - 18 * root.unit; height: parent.height - 48 * root.unit
          clip: true
          readonly property real travel: stationName.width + 48 * root.unit
          readonly property bool scrolling: root.showingDailyVerse

          function restartScroll() {
            tickerAnimation.stop()
            tickerTrack.x = 0
            if (root.opened && scrolling && width > 0) tickerAnimation.start()
          }
          onTravelChanged: restartScroll()
          onWidthChanged: restartScroll()
          onScrollingChanged: restartScroll()
          Connections {
            target: root
            function onOpenedChanged() { stationTicker.restartScroll() }
            function onCurrentDisplayPageChanged() { stationTicker.restartScroll() }
          }
          Item {
            id: tickerTrack
            width: stationTicker.travel * 2
            height: parent.height
            Text {
              id: stationName
              objectName: "radioStationName"
              height: parent.height
              text: root.currentDisplayPage.primary
              textFormat: Text.PlainText
              color: root.skinText
              font.family: root.skinFontFamily
              font.pixelSize: Math.max(11, 14 * root.unit)
              font.weight: Font.Normal
              verticalAlignment: Text.AlignVCenter
            }
            Text {
              x: stationTicker.travel
              height: parent.height
              visible: stationTicker.scrolling
              text: stationName.text
              textFormat: Text.PlainText
              color: stationName.color
              font: stationName.font
              verticalAlignment: Text.AlignVCenter
            }
          }
          XAnimator {
            id: tickerAnimation
            target: tickerTrack
            from: 0
            to: -stationTicker.travel
            duration: Math.max(1000, stationTicker.travel / (24 * root.unit) * 1000)
            loops: Animation.Infinite
            easing.type: Easing.Linear
          }
        }
        Text {
          objectName: "radioStationDetail"
          x: 9 * root.unit; y: parent.height - 38 * root.unit; width: parent.width - 18 * root.unit; height: 31 * root.unit
          text: root.currentDisplayPage.secondary
          textFormat: Text.PlainText
          color: root.skinMuted
          font.family: root.skinFontFamily; font.pixelSize: Math.max(9, 10 * root.unit)
          wrapMode: Text.WordWrap; maximumLineCount: 2; elide: Text.ElideRight
        }
      }
    }

    QQC.AbstractButton {
      id: footswitch
      objectName: "radioFootswitch"
      visible: root.normalizedSkin === 3
      x: root.designX(392); y: 164 * root.unit
      width: root.designX(84); height: 84 * root.unit
      Accessible.name: root.playing ? I18n.t(root.appLanguage, "pauseRadio") : I18n.t(root.appLanguage, "playRadio")
      focusPolicy: Qt.StrongFocus
      hoverEnabled: true
      QQC.ToolTip.visible: hovered
      QQC.ToolTip.text: Accessible.name
      QQC.ToolTip.delay: 350
      onClicked: root.togglePlayback()
      background: Rectangle {
        radius: width / 2
        color: footswitch.down ? Util.alpha(root.skinAccent, 0.25) : "transparent"
        border.color: footswitch.activeFocus || footswitch.hovered ? root.skinAccent : "transparent"
      }
      contentItem: Item {
        PixelIcon {
          name: root.playing ? "pause" : "play"
          color: root.skinAccent
          anchors.centerIn: parent
          width: 20 * root.unit; height: width
          opacity: footswitch.hovered || footswitch.activeFocus || !root.playing ? 1 : 0
          Behavior on opacity { NumberAnimation { duration: 120 } }
        }
      }
    }

    Row {
      id: volumeRow
      x: root.designX(root.skinSpec.volume[0]); y: root.skinSpec.volume[1] * root.unit
      width: root.designX(root.skinSpec.volume[2]); height: 24 * root.unit
      spacing: 10 * root.unit
      Text {
        width: 57 * root.unit; anchors.verticalCenter: parent.verticalCenter
        text: I18n.t(root.appLanguage, "radioVolume")
        color: root.skinMuted; font.family: root.skinFontFamily; font.pixelSize: Math.max(9, 10 * root.unit)
      }
      FocusScope {
        id: volumeSlider
        objectName: "radioVolumeSlider"
        width: volumeRow.width - 126 * root.unit; height: parent.height
        activeFocusOnTab: true
        Accessible.role: Accessible.Slider
        Accessible.name: I18n.t(root.appLanguage, "radioVolume")
        Shortcut {
          sequence: root.keybindings.radioVolumeDown || "Shift+Left"
          context: Qt.WindowShortcut
          enabled: volumeSlider.activeFocus
          onActivated: root.setVolume(root.volume - 0.05)
        }
        Shortcut {
          sequence: root.keybindings.radioVolumeUp || "Shift+Right"
          context: Qt.WindowShortcut
          enabled: volumeSlider.activeFocus
          onActivated: root.setVolume(root.volume + 0.05)
        }
        Rectangle {
          anchors.fill: parent
          color: root.skinInset; border.width: root.unit
          border.color: volumeSlider.activeFocus ? root.skinAccent : root.skinBorder
          radius: root.normalizedSkin === 5 ? height / 2 : Math.min(root.skinRadius, height / 2)
          Rectangle { x: 4 * root.unit; y: parent.height / 2 - 2 * root.unit; width: (parent.width - 8 * root.unit) * root.volume; height: 4 * root.unit; color: root.skinAccent }
          Rectangle {
            width: 24 * root.unit; height: parent.height - 4 * root.unit
            x: 2 * root.unit + (parent.width - width - 4 * root.unit) * root.volume; y: 2 * root.unit
            color: root.skinRaised; border.color: root.skinHighlight
            Row {
              anchors.centerIn: parent; spacing: 3 * root.unit
              Repeater { model: 3; Rectangle { width: root.unit; height: 11 * root.unit; color: root.skinMuted } }
            }
          }
        }
        MouseArea {
          anchors.fill: parent
          cursorShape: Qt.PointingHandCursor
          function setFromX(position) { root.setVolume(position / width) }
          onPressed: function(mouse) { volumeSlider.forceActiveFocus(); setFromX(mouse.x) }
          onPositionChanged: function(mouse) { if (pressed) setFromX(mouse.x) }
          onWheel: function(wheel) {
            if (wheel.modifiers & (Qt.ControlModifier | Qt.AltModifier)) { wheel.accepted = false; return }
            root.setVolume(root.volume + (wheel.angleDelta.y > 0 ? 0.05 : -0.05))
            wheel.accepted = true
          }
        }
      }
      Text {
        width: 49 * root.unit; anchors.verticalCenter: parent.verticalCenter
        text: Math.round(root.volume * 100) + "%"
        color: root.skinAccent; font.family: root.skinFontFamily; font.pixelSize: Math.max(10, 12 * root.unit)
        horizontalAlignment: Text.AlignRight
      }
    }

    Row {
      id: transport
      x: root.designX(root.skinSpec.transport[0]); y: root.skinSpec.transport[1] * root.unit
      spacing: 4 * root.unit
      SkinButton {
        objectName: "radioPrevious"; glyph: "previous"
        enabled: root.stations.length > 0; hint: I18n.t(root.appLanguage, "previousRadioStation")
        onClicked: root.changeStation(-1)
      }
      SkinButton {
        id: playPauseButton
        objectName: "radioPlayPause"; glyph: "play"; lit: true
        enabled: root.stations.length > 0 || root.selectedStation !== null
        hint: I18n.t(root.appLanguage, "playRadio")
        onClicked: root.playCurrent()
      }
      SkinButton {
        objectName: "radioPause"; glyph: "pause"; lit: root.paused
        enabled: root.playing || root.paused
        hint: I18n.t(root.appLanguage, "pauseRadio")
        onClicked: root.togglePlayback()
      }
      SkinButton {
        objectName: "radioStop"; glyph: "stop"
        hint: I18n.t(root.appLanguage, "stopRadio")
        onClicked: root.stopPlayback()
      }
      SkinButton {
        objectName: "radioNext"; glyph: "next"
        enabled: root.stations.length > 0; hint: I18n.t(root.appLanguage, "nextRadioStation")
        onClicked: root.changeStation(1)
      }
    }
    Text {
      anchors.left: transport.right; anchors.leftMargin: 14 * root.unit
      visible: root.normalizedSkin === 1
      anchors.right: parent.right; anchors.rightMargin: 16 * root.unit
      y: transport.y; height: transport.height
      text: "CH " + root.stationNumber() + "  /  " + I18n.t(root.appLanguage, "radioLive")
      color: root.skinAccent; font.family: root.skinFontFamily; font.pixelSize: Math.max(9, 11 * root.unit)
      verticalAlignment: Text.AlignVCenter; horizontalAlignment: Text.AlignRight; elide: Text.ElideRight
    }
    Text {
      id: statusText
      x: 16 * root.unit; y: (root.skinSpec.playlist - 26) * root.unit; width: parent.width - 32 * root.unit; height: 21 * root.unit
      text: root.statusMessage || I18n.t(root.appLanguage, "radioPlaylistHint")
      textFormat: Text.PlainText
      color: player.error === MediaPlayer.NoError ? root.skinMuted : root.skinUrgent
      font.family: root.skinFontFamily; font.pixelSize: Math.max(9, 10 * root.unit)
      elide: Text.ElideRight
      QQC.ToolTip.visible: statusHover.hovered && root.statusMessage !== ""
      QQC.ToolTip.text: root.statusMessage
      HoverHandler { id: statusHover }
    }

    Rectangle {
      id: playlistPanel
      objectName: "radioPlaylist"
      x: 2 * root.unit; y: root.skinSpec.playlist * root.unit
      width: parent.width - 4 * root.unit
      height: Math.max(1, parent.height - y - 32 * root.unit)
      color: root.skinBackground; border.color: root.skinBorder; border.width: root.skinBorderWidth
      radius: root.skinRadius
      TitleStrip {
        id: playlistHeader
        x: 3 * root.unit; y: 2 * root.unit; width: parent.width - 6 * root.unit
        caption: I18n.t(root.appLanguage, "radioPlaylist")
      }
      Row {
        id: playlistSearch
        x: 12 * root.unit
        y: playlistHeader.height + 4 * root.unit
        width: parent.width - 24 * root.unit
        spacing: 4 * root.unit
        LightTextField {
          id: stationSearch
          objectName: "radioStationSearch"
          width: parent.width - favoriteFilter.width - favoriteToggle.width - parent.spacing * 2
          fontSize: Math.max(10, 12 * root.unit)
          placeholderText: I18n.t(root.appLanguage, "searchStations")
          backgroundColor: root.skinInset
          foreground: root.skinText
          muted: root.skinMuted
          borderColor: root.skinBorder
          accent: root.skinAccent
        }
        PixelButton {
          id: favoriteToggle
          height: stationSearch.height
          width: height
          fontSize: stationSearch.fontSize
          horizontalPadding: 4 * root.unit
          verticalPadding: 4 * root.unit
          text: root.favoriteStations.indexOf(root.stationKey(root.currentStation)) >= 0 ? "★" : "☆"
          tooltipText: I18n.t(root.appLanguage, "favoriteStation")
          enabled: root.stations.length > 0 && root.currentStationIndex >= 0
          focusable: true
          foreground: root.skinText
          background: root.skinBackground
          accent: root.skinAccent
          bordered: true
          onClicked: {
            var key = root.stationKey(root.currentStation)
            var next = root.favoriteStations.filter(function(item) { return item !== key })
            if (next.length === root.favoriteStations.length) next.push(key)
            root.favoritesCommitRequested(next)
          }
        }
        PixelButton {
          id: favoriteFilter
          height: stationSearch.height
          horizontalPadding: 8 * root.unit
          verticalPadding: 4 * root.unit
          text: I18n.t(root.appLanguage, root.favoritesOnly ? "allStations" : "favorites")
          fontSize: stationSearch.fontSize
          focusable: true
          foreground: root.skinText
          background: root.skinBackground
          accent: root.skinAccent
          bordered: true
          onClicked: root.favoritesOnly = !root.favoritesOnly
        }
      }
      Rectangle {
        id: listWell
        x: 12 * root.unit; y: playlistSearch.y + playlistSearch.height + 4 * root.unit
        width: parent.width - 24 * root.unit
        height: Math.max(1, parent.height - y - 42 * root.unit)
        color: root.skinInset; border.color: root.skinBorder
        border.width: Math.max(root.unit, root.skinBorderWidth / 2)
        radius: Math.min(root.skinRadius, 10 * root.unit)
        ListView {
          id: stationList
          objectName: "radioStationList"
          anchors.fill: parent; anchors.margins: 4 * root.unit
          clip: true
          model: root.filteredStations
          currentIndex: root.stationIndexIn(root.filteredStations, root.stations[root.currentStationIndex])
          boundsBehavior: Flickable.StopAtBounds
          reuseItems: true
          WheelHandler {
            onWheel: function(event) {
              if (event.angleDelta.y === 0 && event.pixelDelta.y === 0) return
              var delta = event.pixelDelta.y !== 0 ? event.pixelDelta.y : event.angleDelta.y
              root.changeStation(delta > 0 ? -1 : 1)
              event.accepted = true
            }
          }
          Text {
            anchors.centerIn: parent
            visible: root.filteredStations.length === 0
            text: I18n.t(root.appLanguage, "noStationMatches")
            color: root.skinMuted
            font.pixelSize: Math.max(10, 12 * root.unit)
          }
          delegate: Item {
            id: stationRow
            required property int index
            required property var modelData
            readonly property int sourceIndex: root.stationIndexIn(root.stations, modelData)
            readonly property string details: root.stationDetailsFor(modelData, root.playing, root.streamDetailsText)
            property bool pooled: false
            ListView.onPooled: pooled = true
            ListView.onReused: pooled = false
            objectName: "radioStation-" + index
            width: stationList.width - 14 * root.unit; height: 25 * root.unit
            activeFocusOnTab: true
            Accessible.name: String(modelData.name)
            Accessible.role: Accessible.Button
            Keys.onReturnPressed: root.selectStation(sourceIndex, true)
            Keys.onEnterPressed: root.selectStation(sourceIndex, true)

            DropArea {
              id: topStationDrop
              anchors.left: parent.left; anchors.right: parent.right
              anchors.top: parent.top; height: parent.height / 2
              keys: ["light-radio-station"]
              z: 20
              onDropped: function(drop) {
                root.reorderStation(root.draggedStationIndex, stationRow.sourceIndex)
                drop.acceptProposedAction()
              }
            }

            DropArea {
              id: bottomStationDrop
              anchors.left: parent.left; anchors.right: parent.right
              anchors.bottom: parent.bottom; height: parent.height / 2
              keys: ["light-radio-station"]
              z: 20
              onDropped: function(drop) {
                root.reorderStation(root.draggedStationIndex, stationRow.sourceIndex + 1)
                drop.acceptProposedAction()
              }
            }

            Rectangle {
              id: stationDropIndicator
              anchors.left: parent.left; anchors.right: parent.right
              anchors.top: topStationDrop.containsDrag ? parent.top : undefined
              anchors.bottom: bottomStationDrop.containsDrag ? parent.bottom : undefined
              height: Math.max(1, 2 * root.unit)
              visible: topStationDrop.containsDrag || bottomStationDrop.containsDrag
              color: root.skinAccent
              z: 30
            }

            Rectangle {
              id: stationSurface
              width: parent.width; height: parent.height
              color: stationDragArea.containsMouse || stationRow.activeFocus
                ? root.skinHover
                : (stationRow.sourceIndex === root.currentStationIndex ? root.skinSelected : "transparent")
              border.color: stationRow.activeFocus ? root.skinAccent : "transparent"
              z: stationDragArea.drag.active ? 10 : 1
              opacity: stationDragArea.drag.active ? 0.86 : 1
              Drag.active: stationDragArea.drag.active
              Drag.source: stationRow
              Drag.keys: ["light-radio-station"]
              Drag.supportedActions: Qt.MoveAction
              Drag.hotSpot.x: width / 2
              Drag.hotSpot.y: height / 2

              Row {
                anchors.fill: parent
              spacing: 7 * root.unit
              Text {
                width: 29 * root.unit; height: parent.height
                text: (stationRow.sourceIndex + 1) + "."
                color: stationRow.sourceIndex === root.currentStationIndex ? root.skinAccent : root.skinMuted
                font.family: root.skinFontFamily; font.pixelSize: Math.max(11, 14 * root.unit)
                horizontalAlignment: Text.AlignRight; verticalAlignment: Text.AlignVCenter
              }
              Item {
                id: stationLabelArea
                width: stationRow.width - 94 * root.unit; height: parent.height
                TextMetrics {
                  id: stationNameMetrics
                  font: rowLabel.font
                  text: rowLabel.text
                }
                Text {
                  id: rowLabel
                  objectName: "radioStationLabel-" + stationRow.index
                  width: stationRow.details
                    ? Math.min(stationNameMetrics.advanceWidth, parent.width * 0.45) : parent.width
                  height: parent.height
                  text: String(stationRow.modelData.name)
                  textFormat: Text.PlainText
                  color: stationRow.sourceIndex === root.currentStationIndex ? root.skinAccent : root.skinText
                  font.family: root.skinFontFamily; font.pixelSize: Math.max(11, 14 * root.unit)
                  verticalAlignment: Text.AlignVCenter; elide: Text.ElideRight
                }
                Item {
                  id: rowTicker
                  x: rowLabel.width + 8 * root.unit
                  width: Math.max(0, parent.width - x); height: parent.height
                  visible: stationRow.details !== ""
                  clip: true
                  readonly property real travel: Math.max(rowDetails.implicitWidth, width) + 48 * root.unit
                  readonly property bool animate: visible && root.opened && !stationRow.pooled
                    && stationRow.y + stationRow.height > stationList.contentY
                    && stationRow.y < stationList.contentY + stationList.height
                  function restartScroll() {
                    rowAnimation.stop()
                    rowTrack.x = 0
                    if (animate && width > 0) rowAnimation.start()
                  }
                  onAnimateChanged: restartScroll()
                  onTravelChanged: restartScroll()
                  onWidthChanged: restartScroll()
                  Connections {
                    target: stationRow
                    function onDetailsChanged() { rowTicker.restartScroll() }
                  }
                  Item {
                    id: rowTrack
                    width: rowTicker.travel * 2; height: parent.height
                    Text {
                      id: rowDetails
                      objectName: "radioStationMetadata-" + stationRow.index
                      height: parent.height
                      text: stationRow.details
                      textFormat: Text.PlainText
                      color: root.skinMuted
                      font.family: root.skinFontFamily; font.pixelSize: Math.max(9, 10 * root.unit)
                      verticalAlignment: Text.AlignVCenter
                    }
                    Text {
                      x: rowTicker.travel
                      height: parent.height
                      text: rowDetails.text
                      textFormat: Text.PlainText
                      color: rowDetails.color
                      font: rowDetails.font
                      verticalAlignment: Text.AlignVCenter
                    }
                  }
                  XAnimator {
                    id: rowAnimation
                    target: rowTrack
                    from: 0
                    to: -rowTicker.travel
                    duration: Math.max(1000, rowTicker.travel / (24 * root.unit) * 1000)
                    loops: Animation.Infinite
                    easing.type: Easing.Linear
                  }
                }
              }
              Text {
                width: 40 * root.unit; height: parent.height
                text: I18n.t(root.appLanguage, "radioLive")
                color: stationRow.sourceIndex === root.currentStationIndex ? root.skinAccent : root.skinMuted
                font.family: root.skinFontFamily; font.pixelSize: Math.max(9, 10 * root.unit)
                horizontalAlignment: Text.AlignRight; verticalAlignment: Text.AlignVCenter
              }
            }

              MouseArea {
                id: stationDragArea
                anchors.fill: parent
                acceptedButtons: Qt.LeftButton
                hoverEnabled: true
                preventStealing: true
                cursorShape: drag.active ? Qt.ClosedHandCursor : Qt.PointingHandCursor
                drag.target: stationSurface
                drag.axis: Drag.YAxis
                drag.minimumY: stationList.contentY - stationRow.y
                drag.maximumY: stationList.contentY + stationList.height - stationRow.y - stationSurface.height
                onPressed: {
                  root.draggedStationIndex = stationRow.sourceIndex
                  stationRow.forceActiveFocus()
                }
                onClicked: root.selectStation(stationRow.sourceIndex, true)
                onPositionChanged: function(mouse) {
                  if (!drag.active) return
                  var point = mapToItem(stationList, mouse.x, mouse.y)
                  if (point.y < 18 * root.unit)
                    stationList.contentY = Math.max(stationList.originY, stationList.contentY - 9 * root.unit)
                  else if (point.y > stationList.height - 18 * root.unit)
                    stationList.contentY = Math.min(
                      stationList.originY + Math.max(0, stationList.contentHeight - stationList.height),
                      stationList.contentY + 9 * root.unit
                    )
                }
                onReleased: {
                  stationSurface.Drag.drop()
                  stationSurface.y = 0
                  root.draggedStationIndex = -1
                }
                onCanceled: {
                  stationSurface.y = 0
                  root.draggedStationIndex = -1
                }
              }
              TapHandler {
                acceptedButtons: Qt.RightButton
                gesturePolicy: TapHandler.ReleaseWithinBounds
                onTapped: function(eventPoint) {
                  var point = stationSurface.mapToItem(root, eventPoint.position.x, eventPoint.position.y)
                  root.openStationContextMenu(stationRow.modelData, point.x, point.y)
                }
              }
            }
          }
          QQC.ScrollBar.vertical: QQC.ScrollBar {
            id: playlistScroll
            width: 11 * root.unit
            minimumSize: 0.12
            policy: QQC.ScrollBar.AlwaysOn
            contentItem: Rectangle {
              implicitWidth: 9 * root.unit
              color: playlistScroll.pressed ? root.skinMuted : root.skinRaised
              border.color: root.skinHighlight
              Rectangle { anchors.centerIn: parent; width: root.unit; height: Math.min(24 * root.unit, parent.height - 4); color: root.skinMuted }
            }
            background: Rectangle { color: root.skinInset; border.color: root.skinBorder }
          }
        }
        Text {
          anchors.fill: parent; anchors.margins: 12 * root.unit
          visible: root.stations.length === 0
          text: I18n.t(root.appLanguage, "radioNoStations")
          color: root.skinMuted; font.family: root.skinFontFamily; font.pixelSize: Math.max(11, 13 * root.unit)
          wrapMode: Text.WordWrap; verticalAlignment: Text.AlignVCenter; horizontalAlignment: Text.AlignHCenter
        }
      }
      InlineOptionPopup {
        id: stationContextMenu
        objectName: "radioStationContextMenu"
        parent: root
        z: 50
        width: Math.min(root.width, Style.space(180))
        value: ""
        fontPixelSize: Math.max(10, 12 * root.unit)
        onSelected: function(option) { root.runStationContextAction(String(option.value || "")) }
      }
      QQC.AbstractButton {
        id: stationSettingsButton
        objectName: "radioStationSettings"
        x: 12 * root.unit; anchors.bottom: parent.bottom; anchors.bottomMargin: 8 * root.unit
        width: 32 * root.unit; height: 26 * root.unit
        focusPolicy: Qt.StrongFocus
        hoverEnabled: true
        Accessible.name: I18n.t(root.appLanguage, "radioSettings")
        QQC.ToolTip.visible: hovered
        QQC.ToolTip.text: Accessible.name
        QQC.ToolTip.delay: 350
        Keys.onReturnPressed: clicked()
        Keys.onEnterPressed: clicked()
        background: Item {}
        contentItem: Item {
          PixelIcon {
            anchors.centerIn: parent
            width: Math.max(Style.space(14), Math.round(18 * root.unit))
            height: width
            name: "settings"
            color: stationSettingsButton.activeFocus || stationSettingsButton.hovered
              ? root.skinAccent : root.skinText
          }
        }
        onClicked: root.settingsRequested()
      }
      Text {
        anchors.right: parent.right; anchors.rightMargin: 16 * root.unit
        anchors.bottom: parent.bottom; anchors.bottomMargin: 14 * root.unit
        text: root.stations.length + " " + I18n.t(root.appLanguage, "radioStations") + "  /  " + root.elapsedText
        color: root.skinMuted; font.family: root.skinFontFamily; font.pixelSize: Math.max(9, 11 * root.unit)
      }
    }

    Row {
      id: skinPicker
      objectName: "radioSkinDots"
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.bottom: parent.bottom
      anchors.bottomMargin: 3 * root.unit
      spacing: 2 * root.unit
      Repeater {
        model: root.displayedSkinOrder
        delegate: Item {
          id: skinDotItem
          required property int index
          required property var modelData
          readonly property int skinNumber: Number(modelData)
          width: 24 * root.unit
          height: 26 * root.unit
          z: skinDragArea.drag.active ? 30 : 1

          DropArea {
            id: skinDotDropArea
            anchors.fill: parent
            keys: ["light-radio-skin"]
            onDropped: function(drop) {
              var sourceSkin = root.draggedSkinNumber
              var targetSkin = skinDotItem.skinNumber
              var placeAfter = drop.x > skinDotDropArea.width / 2
              Qt.callLater(function() {
                root.reorderSkin(sourceSkin, targetSkin, placeAfter)
              })
              drop.acceptProposedAction()
            }
          }

          Rectangle {
            width: Math.max(root.unit, 2 * root.unit)
            height: parent.height
            anchors.left: skinDotDropArea.containsDrag
              && skinDotDropArea.drag.x <= skinDotDropArea.width / 2 ? parent.left : undefined
            anchors.right: skinDotDropArea.containsDrag
              && skinDotDropArea.drag.x > skinDotDropArea.width / 2 ? parent.right : undefined
            visible: skinDotDropArea.containsDrag
            color: root.skinAccent
            z: 20
          }

          QQC.AbstractButton {
            id: skinDot
            objectName: "radioSkinDot-" + skinDotItem.skinNumber
            x: 0
            y: 0
            width: parent.width
            height: parent.height
            focusPolicy: Qt.StrongFocus
            checkable: true
            checked: root.normalizedSkin === skinDotItem.skinNumber
            Accessible.name: skinDotItem.skinNumber + " · " + RadioSkins.spec(skinDotItem.skinNumber).name
            Keys.onReturnPressed: root.skinCommitRequested(skinDotItem.skinNumber)
            onClicked: root.skinCommitRequested(skinDotItem.skinNumber)
            z: skinDragArea.drag.active ? 30 : 1
            opacity: skinDragArea.drag.active ? 0.7 : 1
            Drag.active: skinDragArea.drag.active
            Drag.source: skinDotItem
            Drag.keys: ["light-radio-skin"]
            Drag.supportedActions: Qt.MoveAction
            Drag.hotSpot.x: width / 2
            Drag.hotSpot.y: height / 2
            background: Rectangle {
              anchors.centerIn: parent
              width: 9 * root.unit
              height: width
              radius: width / 2
              color: skinDot.checked ? root.skinAccent : skinDot.hovered ? root.skinMuted : "transparent"
              border.color: skinDot.checked || skinDot.activeFocus ? root.skinAccent : root.skinMuted
              border.width: skinDot.activeFocus ? 2 * root.unit : root.unit
            }
            QQC.ToolTip.visible: hovered
            QQC.ToolTip.text: Accessible.name
            QQC.ToolTip.delay: 350

            MouseArea {
              id: skinDragArea
              property bool dragOccurred: false
              anchors.fill: parent
              z: 100
              hoverEnabled: true
              preventStealing: true
              cursorShape: drag.active ? Qt.ClosedHandCursor : Qt.OpenHandCursor
              drag.target: skinDot
              drag.axis: Drag.XAxis
              onPressed: {
                dragOccurred = false
                root.draggedSkinNumber = skinDotItem.skinNumber
              }
              onPositionChanged: if (drag.active) dragOccurred = true
              onReleased: function(mouse) {
                if (dragOccurred) {
                  var point = mapToItem(skinPicker, mouse.x, mouse.y)
                  root.reorderSkinAtPosition(root.draggedSkinNumber, point.x)
                }
                skinDot.x = 0
                skinDot.y = 0
                root.draggedSkinNumber = -1
                dragOccurred = false
              }
              onCanceled: {
                skinDot.Drag.cancel()
                skinDot.x = 0
                skinDot.y = 0
                root.draggedSkinNumber = -1
                dragOccurred = false
              }
              onClicked: root.skinCommitRequested(skinDotItem.skinNumber)
            }
          }
        }
      }
    }
  }
}
