import QtQuick

// Radio playback is standard QtMultimedia. Native PCM effects are an optional
// enhancement, isolated so a missing/ABI-incompatible module cannot break radio.
Item {
  id: root
  property var player: null
  property real gain: 1
  property bool active: false
  property bool nativeAvailable: false
  property url nativeSource: ""
  readonly property var nativeFeatures: nativeLoader.item
  readonly property bool available: nativeLoader.status === Loader.Ready
  readonly property var levels: available && nativeFeatures ? nativeFeatures.levels : [0, 0]
  readonly property var waveform: available && nativeFeatures ? nativeFeatures.waveform : []
  readonly property bool scratching: available && nativeFeatures && nativeFeatures.scratching
  readonly property real scratchMix: available && nativeFeatures ? nativeFeatures.scratchMix : 0
  readonly property string title: available && nativeFeatures ? nativeFeatures.title : ""
  signal measurementsChanged()
  function beginScratch() { return available && nativeFeatures && nativeFeatures.beginScratch() }
  function moveScratch(radians, seconds) { if (available && nativeFeatures) nativeFeatures.moveScratch(radians, seconds) }
  function endScratch() { if (available && nativeFeatures) nativeFeatures.endScratch() }
  Loader {
    id: nativeLoader
    active: root.nativeAvailable
    source: active ? root.nativeSource : ""
    onLoaded: {
      item.player = Qt.binding(function() { return root.player })
      item.gain = Qt.binding(function() { return root.gain })
      item.active = Qt.binding(function() { return root.active })
    }
  }
  Connections {
    target: nativeLoader.item
    function onMeasurementsChanged() { root.measurementsChanged() }
  }
}
