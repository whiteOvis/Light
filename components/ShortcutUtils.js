.pragma library

function expandedSequences(value) {
  var primary = String(value || "").trim()
  if (primary === "") return []

  var sequences = [primary]
  // Shortcut capture names both Enter keys alike; Qt distinguishes them.
  // Comma/Period are capture labels rather than portable QKeySequence names.
  if (/(^|\+)Enter$/i.test(primary)) sequences.push(primary.replace(/Enter$/i, "Return"))
  if (/(^|\+)Comma$/i.test(primary)) sequences.push(primary.replace(/Comma$/i, ","))
  if (/(^|\+)Period$/i.test(primary)) sequences.push(primary.replace(/Period$/i, "."))
  // On common keyboard layouts, typing + means pressing Shift and the plus
  // key together. QKeySequence keeps Shift as part of the incoming event, so
  // a portable shortcut such as Alt++ also needs both shifted forms Qt can
  // produce: Key_Plus and the underlying Key_Equal.
  var hasShift = /(^|\+)shift\+/i.test(primary)
  if (/\+\+$/.test(primary)) {
    if (hasShift) sequences.push(primary.slice(0, -1) + "=")
    else {
      sequences.push(primary.slice(0, -2) + "+Shift++")
      sequences.push(primary.slice(0, -2) + "+Shift+=")
    }
  }
  // Qt reports shifted number keys as punctuation on common layouts.
  // Modifier order can vary in saved or custom bindings.
  var shiftedDigit = primary.match(/(?:^|\+)([0-9])$/)
  if (hasShift && shiftedDigit)
    sequences.push(primary.slice(0, -1) + ")!@#$%^&*("[Number(shiftedDigit[1])])
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
