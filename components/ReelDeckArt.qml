pragma ComponentBehavior: Bound
import QtQuick

// Original procedural artwork: a low-resolution hardware layer under crisp
// native text and controls. No media or fonts are needed to render the deck.
Item {
  id: root
  property bool playing: false
  property int frame: 0

  Canvas {
    id: cabinet
    anchors.fill: parent
    smooth: false
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()
    onPaint: {
      var c = getContext("2d")
      c.setTransform(1, 0, 0, 1, 0, 0)
      c.clearRect(0, 0, width, height)
      c.scale(width / 360, height / 320)
      function block(x, y, w, h, color) {
        c.fillStyle = color
        c.fillRect(x, y, w, h)
      }
      block(30, 307, 303, 10, "#111722")
      block(24, 63, 312, 246, "#402c2b")
      block(28, 60, 304, 244, "#98603f")
      block(32, 62, 296, 240, "#c18752")
      block(37, 64, 286, 235, "#5b5b62")
      block(39, 67, 280, 158, "#85838b")
      block(43, 70, 273, 150, "#929098")
      block(39, 225, 280, 77, "#61646a")
      block(39, 225, 280, 3, "#b3a18a")
      block(39, 256, 280, 2, "#939599")
      block(39, 297, 280, 3, "#30353f")
      // Wood cheeks, stepped highlights, feet, and ventilation.
      block(28, 68, 5, 236, "#d19b69")
      block(327, 67, 5, 237, "#724632")
      block(37, 214, 286, 9, "#c58347")
      block(37, 215, 100, 3, "#e9ac66")
      block(227, 219, 96, 3, "#a76837")
      block(41, 302, 276, 8, "#242632")
      for (var vent = 0; vent < 23; vent++) block(44 + vent * 12, 303, 8, 6, "#666b71")
      block(42, 310, 24, 7, "#d4a473")
      block(294, 310, 24, 7, "#d4a473")
      block(42, 317, 24, 3, "#986442")
      block(294, 317, 24, 3, "#986442")
      // Exposed tape mechanism and silver bridge below the reels.
      block(170, 46, 20, 90, "#4f5362")
      for (var slit = 0; slit < 13; slit++) block(172, 49 + slit * 6, 16, 2, "#262936")
      block(79, 149, 204, 26, "#292b37")
      block(91, 155, 177, 15, "#bacfdb")
      block(95, 153, 173, 3, "#e3eef0")
      block(101, 157, 159, 10, "#707f90")
      block(109, 159, 139, 8, "#a6bdce")
      block(91, 170, 177, 4, "#d6e4ef")
      block(102, 174, 153, 3, "#647386")
      for (var head = 0; head < 3; head++) {
        block(127 + head * 43, 155, 13, 16, "#d1d9dc")
        block(132 + head * 43, 158, 3, 10, "#464858")
      }
      block(274, 147, 8, 25, "#242735")
      block(276, 151, 3, 16, "#99acb9")
      // Recesses for the native station display and raised transport keys.
      block(49, 179, 262, 36, "#363039")
      block(51, 181, 258, 32, "#171e23")
      block(52, 182, 256, 1, "#dfab63")
      block(49, 231, 262, 22, "#3b343c")
      block(51, 233, 258, 19, "#24232d")
      // Small status lamps and screw heads.
      for (var screw = 0; screw < 4; screw++) {
        var sx = screw % 2 === 0 ? 44 : 310
        var sy = screw < 2 ? 219 : 291
        block(sx, sy, 4, 4, "#c0c7cc")
        block(sx + 1, sy + 1, 2, 2, "#444550")
      }
    }
  }

  Item {
    objectName: "radioTapeHeads"
    x: parent.width * 0.25; y: parent.height * 0.47
    width: parent.width * 0.5; height: parent.height * 0.08
  }

  Rectangle {
    objectName: "radioMovingTape"
    x: parent.width * 0.28; y: parent.height * 0.527
    width: parent.width * 0.43; height: Math.max(1, parent.height / 320)
    color: root.playing && root.frame % 3 === 0 ? "#d7b78a" : "#6c4f40"
  }

  Repeater {
    model: 2
    delegate: Item {
      id: reel
      required property int index
      objectName: "radioReel-" + reel.index
      x: root.width * (reel.index === 0 ? 0.025 : 0.497)
      y: 0
      width: root.width * 0.478
      height: width

      Canvas {
        id: rotor
        objectName: "radioReelRotor-" + reel.index
        anchors.fill: parent
        smooth: false
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()
        property int frame: root.frame
        onFrameChanged: requestPaint()
        onPaint: {
          var c = getContext("2d")
          c.setTransform(1, 0, 0, 1, 0, 0)
          c.clearRect(0, 0, width, height)
          c.scale(width / 172, height / 172)
          function block(x, y, w, h, color) {
            c.fillStyle = color
            c.fillRect(Math.round(x), Math.round(y), w, h)
          }
          function disc(cx, cy, radius, color) {
            // Two-pixel scanlines produce a deliberate stepped silhouette.
            for (var dy = -radius; dy < radius; dy += 2) {
              var dx = Math.floor(Math.sqrt(radius * radius - dy * dy) / 2) * 2
              block(cx - dx, cy + dy, dx * 2, 2.15, color)
            }
          }
          disc(87, 88, 83, "#332730")
          disc(85, 83, 82, "#a26943")
          disc(84, 81, 80, "#d29a64")
          disc(85, 83, 77, "#704138")
          disc(85, 83, 74, "#7c493d")
          disc(85, 83, 69, "#744137")
          var rotation = root.frame * Math.PI * 2 / 120
          // Three teardrop reel cut-outs expose the dark tape beneath.
          for (var hole = 0; hole < 3; hole++) {
            var a = rotation + hole * Math.PI * 2 / 3
            c.save()
            c.translate(85, 83)
            c.rotate(a)
            c.fillStyle = "#222635"
            c.beginPath()
            c.moveTo(31, -10); c.lineTo(53, -17); c.lineTo(65, -10)
            c.lineTo(67, 4); c.lineTo(57, 15); c.lineTo(32, 10)
            c.closePath(); c.fill()
            block(56, -9, 6, 13, "#a4a4ab")
            block(56, -9, 6, 3, "#d6d7d6")
            c.restore()
          }
          disc(85, 83, 30, "#ffdf75")
          disc(85, 85, 26, "#9e5631")
          disc(85, 83, 23, "#e9a54b")
          disc(85, 83, 18, "#54454a")
          disc(85, 83, 12, "#ffc950")
          block(82, 80, 6, 6, "#b5a765")
          block(83, 80, 2, 2, "#fff0a0")
        }
      }
    }
  }
}
