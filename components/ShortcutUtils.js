.pragma library

function expandedSequences(value) {
  var primary = String(value || "").trim()
  if (primary === "") return []

  var sequences = [primary]
  // On common keyboard layouts, typing + means pressing Shift and the plus
  // key together. QKeySequence keeps Shift as part of the incoming event, so
  // a portable shortcut such as Alt++ also needs both shifted forms Qt can
  // produce: Key_Plus and the underlying Key_Equal.
  if (/\+\+$/.test(primary) && !/\+shift\+\+$/i.test(primary)) {
    sequences.push(primary.slice(0, -2) + "+Shift++")
    sequences.push(primary.slice(0, -2) + "+Shift+=")
  }
  return sequences
}

function wheelDelta(angleX, angleY, pixelX, pixelY) {
  var normalizedAngleY = Number(angleY)
  if (isFinite(normalizedAngleY) && normalizedAngleY !== 0)
    return normalizedAngleY

  var normalizedAngleX = Number(angleX)
  if (isFinite(normalizedAngleX) && normalizedAngleX !== 0)
    return normalizedAngleX

  var normalizedPixelY = Number(pixelY)
  if (isFinite(normalizedPixelY) && normalizedPixelY !== 0)
    return normalizedPixelY * 3

  var normalizedPixelX = Number(pixelX)
  if (isFinite(normalizedPixelX) && normalizedPixelX !== 0)
    return normalizedPixelX * 3

  return 0
}
