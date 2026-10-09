pragma ComponentBehavior: Bound
import QtQuick
import qs.Commons

// Light's shared compact icon renderer. The paths are drawn on a normalized
// vector canvas so every symbol stays crisp at fractional display scaling.
Item {
  id: root

  property string name: "close"
  property color color: Color.popups.text
  property color accentColor: Color.accent
  property bool useAccentPixels: false
  property real glyphScale: 0.82

  readonly property var supportedNames: [
    "music", "settings", "close", "previous", "next", "play", "pause",
    "stop", "volume", "mute", "down", "left", "right", "cross"
  ]
  readonly property bool validGlyph: supportedNames.indexOf(name) >= 0
  readonly property real glyphSize: Math.max(1, Math.min(width, height) * glyphScale)

  onNameChanged: iconCanvas.requestPaint()
  onColorChanged: iconCanvas.requestPaint()
  onAccentColorChanged: iconCanvas.requestPaint()
  onUseAccentPixelsChanged: iconCanvas.requestPaint()
  onGlyphScaleChanged: iconCanvas.requestPaint()

  Canvas {
    id: iconCanvas
    anchors.centerIn: parent
    width: root.glyphSize
    height: root.glyphSize
    antialiasing: true

    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    onPaint: {
      var context = getContext("2d")
      var unit = Math.min(width, height) / 24
      context.clearRect(0, 0, width, height)
      context.save()
      context.scale(unit, unit)
      context.strokeStyle = String(root.color)
      context.fillStyle = String(root.color)
      context.lineWidth = 2
      context.lineCap = "round"
      context.lineJoin = "round"

      function line(x1, y1, x2, y2) {
        context.beginPath()
        context.moveTo(x1, y1)
        context.lineTo(x2, y2)
        context.stroke()
      }

      function noteHead(x, y) {
        context.beginPath()
        context.arc(x, y, 2.65, 0, Math.PI * 2)
        context.fill()
      }

      function speaker() {
        context.beginPath()
        context.moveTo(4, 10)
        context.lineTo(8, 10)
        context.lineTo(13, 6)
        context.lineTo(13, 18)
        context.lineTo(8, 14)
        context.lineTo(4, 14)
        context.closePath()
        context.fill()
      }

      switch (String(root.name || "")) {
      case "music":
        context.lineWidth = 2.15
        context.beginPath()
        context.moveTo(8.5, 17)
        context.lineTo(8.5, 7)
        context.lineTo(18.5, 5)
        context.lineTo(18.5, 15)
        context.stroke()
        line(9, 9.2, 18, 7.4)
        noteHead(6.2, 17.2)
        noteHead(16.2, 15.2)
        break
      case "settings":
        // A filled body with broad rectangular teeth reads as a mechanical
        // gear at compact sizes. The previous thin ring and radial strokes
        // resembled a ship's wheel even though they used the same footprint.
        context.save()
        context.translate(12, 12)
        context.beginPath()
        context.arc(0, 0, 7.45, 0, Math.PI * 2)
        context.fill()
        for (var tooth = 0; tooth < 8; tooth++) {
          context.save()
          context.rotate(tooth * Math.PI / 4)
          context.fillRect(-1.75, -10, 3.5, 4.15)
          context.restore()
        }
        context.globalCompositeOperation = "destination-out"
        context.beginPath()
        context.arc(0, 0, 2.65, 0, Math.PI * 2)
        context.fill()
        context.globalCompositeOperation = "source-over"
        context.restore()
        break
      case "close":
        context.lineWidth = 1.7
        line(6.25, 6.25, 17.75, 17.75)
        line(17.75, 6.25, 6.25, 17.75)
        break
      case "previous":
        context.fillRect(5, 6, 2, 12)
        context.beginPath()
        context.moveTo(18, 5.5)
        context.lineTo(8.5, 12)
        context.lineTo(18, 18.5)
        context.closePath()
        context.fill()
        break
      case "next":
        context.fillRect(17, 6, 2, 12)
        context.beginPath()
        context.moveTo(6, 5.5)
        context.lineTo(15.5, 12)
        context.lineTo(6, 18.5)
        context.closePath()
        context.fill()
        break
      case "play":
        context.beginPath()
        context.moveTo(7.5, 5)
        context.lineTo(19, 12)
        context.lineTo(7.5, 19)
        context.closePath()
        context.fill()
        break
      case "pause":
        context.fillRect(6.5, 5, 4, 14)
        context.fillRect(13.5, 5, 4, 14)
        break
      case "stop":
        context.fillRect(6, 6, 12, 12)
        break
      case "volume":
        speaker()
        context.lineWidth = 1.9
        context.beginPath()
        context.arc(12.2, 12, 4.6, -0.78, 0.78)
        context.stroke()
        context.beginPath()
        context.arc(12, 12, 8, -0.72, 0.72)
        context.stroke()
        break
      case "mute":
        speaker()
        context.lineWidth = 2
        line(16.5, 8.5, 21, 15.5)
        line(21, 8.5, 16.5, 15.5)
        break
      case "down":
        context.lineWidth = 2.35
        context.beginPath()
        context.moveTo(5.5, 8.5)
        context.lineTo(12, 15)
        context.lineTo(18.5, 8.5)
        context.stroke()
        break
      case "left":
        context.lineWidth = 2.25
        context.beginPath()
        context.moveTo(11, 6)
        context.lineTo(5, 12)
        context.lineTo(11, 18)
        context.stroke()
        line(5.5, 12, 19, 12)
        break
      case "right":
        context.lineWidth = 2.25
        context.beginPath()
        context.moveTo(13, 6)
        context.lineTo(19, 12)
        context.lineTo(13, 18)
        context.stroke()
        line(5, 12, 18.5, 12)
        break
      case "cross":
        context.fillRect(10, 3, 4, 18)
        context.fillRect(5, 7, 14, 4)
        break
      default:
        context.lineWidth = 1.8
        context.strokeRect(5, 5, 14, 14)
        break
      }

      context.restore()
    }
  }
}
