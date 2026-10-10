import QtQuick
import "LightAudio"
Item {
  id: root
  property var player: null
  property real gain: 1
  property bool active: false
  readonly property var levels: tap.levels
  readonly property var waveform: tap.waveform
  readonly property bool scratching: tap.scratching
  readonly property real scratchMix: tap.scratchMix
  readonly property string title: metadata.title
  signal measurementsChanged()
  function beginScratch() { return tap.beginScratch() }
  function moveScratch(radians, seconds) { tap.moveScratch(radians, seconds) }
  function endScratch() { tap.endScratch() }
  AudioTap {
    id: tap
    player: root.player
    gain: root.gain
    active: root.active
    onMeasurementsChanged: root.measurementsChanged()
  }
  RadioMetadata { id: metadata; source: root.player ? root.player.source : ""; active: root.active }
}
