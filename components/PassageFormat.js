.pragma library

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function richText(content) {
  var source = String(content || "").trim()
  if (!source) return ""
  if (/<[A-Za-z][^>]*>/.test(source)) return source
  return "<p>" + escapeHtml(source).replace(/\n\s*\n/g, "</p><p>").replace(/\n/g, "<br>") + "</p>"
}

// YouVersion's API HTML intentionally places .yv-vlbl directly beside the
// verse text. Its official renderer adds a non-breaking space to the label
// during transformation so the number and first word stay together. Qt Rich
// Text does not support the SDK's ::after fallback, so do the same explicitly.
function addNbspToVerseLabels(content) {
  return String(content || "").replace(
    /<(span|sup)\b([^>]*class=["'][^"']*\byv-vlbl\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    function(all, tag, attributes, label) {
      if (/(?:\u00a0|&nbsp;|&#160;|&#x0*a0;)\s*$/i.test(label)) return all
      return "<" + tag + attributes + ">" + label + "&#160;</" + tag + ">"
    }
  )
}

function highlightVerseSpecs(highlights, highlightOpacity) {
  var specs = {}
  var opacity = normalizedHighlightOpacity(highlightOpacity)
  var items = highlights && typeof highlights.length === "number" ? highlights : []
  for (var i = 0; i < items.length; i++) {
    var item = items[i] || {}
    var passage = String(item.passage || item.passage_id || "").toUpperCase()
    var match = passage.match(/\.(\d+)(?:-(\d+))?$/)
    var color = String(item.color || "").replace(/^#/, "").toLowerCase()
    if (!match || !/^[0-9a-f]{6}$/.test(color)) continue
    var first = Number(match[1])
    var last = match[2] ? Number(match[2]) : first
    var selectionRanges = item.selectionRanges && typeof item.selectionRanges.length === "number"
      ? item.selectionRanges
      : []
    for (var verse = first; verse <= last; verse++) {
      var verseRanges = []
      for (var rangeIndex = 0; rangeIndex < selectionRanges.length; rangeIndex++) {
        var range = selectionRanges[rangeIndex] || {}
        var rangePassage = String(range.passage || "").toUpperCase()
        var rangeVerse = rangePassage.match(/\.(\d+)$/)
        var start = Number(range.start)
        var end = Number(range.end)
        if (
          rangeVerse
          && Number(rangeVerse[1]) === verse
          && isFinite(start)
          && isFinite(end)
          && start >= 0
          && end > start
        ) {
          verseRanges.push({ start: Math.floor(start), end: Math.floor(end) })
        }
      }
      specs[String(verse)] = {
        color: color,
        background: highlightBackgroundColor(color, opacity),
        ranges: verseRanges
      }
    }
  }
  return specs
}

function normalizedHighlightOpacity(value) {
  var opacity = Number(value)
  if (!isFinite(opacity)) return 0.45
  return Math.round(Math.max(0.2, Math.min(0.75, opacity)) * 100) / 100
}

function highlightBackgroundColor(color, opacity) {
  var normalized = String(color || "").replace(/^#/, "").toLowerCase()
  if (!/^[0-9a-f]{6}$/.test(normalized)) return ""
  var red = parseInt(normalized.slice(0, 2), 16)
  var green = parseInt(normalized.slice(2, 4), 16)
  var blue = parseInt(normalized.slice(4, 6), 16)
  return "rgba(" + red + "," + green + "," + blue + "," + opacity.toFixed(2) + ")"
}

function decodedText(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, function(all, digits) {
      return String.fromCharCode(parseInt(digits, 16))
    })
    .replace(/&#(\d+);/g, function(all, digits) {
      return String.fromCharCode(parseInt(digits, 10))
    })
    .replace(/&nbsp;/gi, "\u00a0")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
}

function inlineTextLength(value) {
  return decodedText(String(value || "").replace(/<[^>]*>/g, "")).length
}

function linkedVerseTextLengths(formattedText) {
  var lengths = {}
  var source = String(formattedText || "")
  var linkPattern = /<a\b[^>]*href=["']light-verse:(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi
  var match
  while ((match = linkPattern.exec(source)) !== null) {
    var verse = String(Number(match[1]))
    lengths[verse] = (lengths[verse] || 0) + inlineTextLength(match[2])
  }
  return lengths
}

// Convert Qt's formatted selection into offsets within each verse's visible
// linked text. Offsets are stable across styling changes and keep remote
// YouVersion highlights verse-compatible while Light renders exact selections.
function selectionRanges(formattedPrefix, formattedSelection, basePassage) {
  var base = String(basePassage || "").toUpperCase()
  if (!/^[A-Z0-9]{3}\.\d+$/.test(base)) return []
  var prefixLengths = linkedVerseTextLengths(formattedPrefix)
  var selectionLengths = linkedVerseTextLengths(formattedSelection)
  var verses = Object.keys(selectionLengths).sort(function(a, b) {
    return Number(a) - Number(b)
  })
  var result = []
  for (var i = 0; i < verses.length; i++) {
    var verse = verses[i]
    var length = Number(selectionLengths[verse] || 0)
    if (length <= 0) continue
    var start = Number(prefixLengths[verse] || 0)
    result.push({
      passage: base + "." + verse,
      start: start,
      end: start + length
    })
  }
  return result
}

function highlightPassageRange(value) {
  var match = String(value || "").toUpperCase().match(
    /^([A-Z0-9]{3}\.\d+)\.(\d+)(?:-(\d+))?$/
  )
  if (!match) return null
  return {
    base: match[1],
    first: Number(match[2]),
    last: match[3] ? Number(match[3]) : Number(match[2])
  }
}

function highlightContainsVerse(highlight, passage) {
  var range = highlightPassageRange(highlight && (highlight.passage || highlight.passage_id))
  var verse = String(passage || "").toUpperCase().match(
    /^([A-Z0-9]{3}\.\d+)\.(\d+)$/
  )
  return !!range && !!verse && verse[1] === range.base
    && Number(verse[2]) >= range.first && Number(verse[2]) <= range.last
}

// Resolve the saved highlight underneath a text selection. Locally-created
// highlights retain exact character offsets; highlights imported from
// YouVersion apply to their complete verse or verse range.
function highlightForSelection(highlights, selectedRanges) {
  var items = highlights && typeof highlights.length === "number" ? highlights : []
  var selections = selectedRanges && typeof selectedRanges.length === "number"
    ? selectedRanges
    : []
  for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
    var item = items[itemIndex] || {}
    var passage = String(item.passage || item.passage_id || "").toUpperCase()
    var savedRanges = item.selectionRanges && typeof item.selectionRanges.length === "number"
      ? item.selectionRanges
      : []
    for (var selectionIndex = 0; selectionIndex < selections.length; selectionIndex++) {
      var selected = selections[selectionIndex] || {}
      var selectedPassage = String(selected.passage || "").toUpperCase()
      var selectedStart = Number(selected.start)
      var selectedEnd = Number(selected.end)
      if (savedRanges.length === 0 && highlightContainsVerse(item, selectedPassage))
        return passage
      for (var savedIndex = 0; savedIndex < savedRanges.length; savedIndex++) {
        var saved = savedRanges[savedIndex] || {}
        if (String(saved.passage || "").toUpperCase() !== selectedPassage) continue
        if (selectedEnd > Number(saved.start) && selectedStart < Number(saved.end))
          return passage
      }
    }
  }
  return ""
}

// Resolve a click within rendered verse text to an existing highlight.
function highlightAtPosition(highlights, basePassage, verse, formattedPrefix) {
  var base = String(basePassage || "").toUpperCase()
  var verseNumber = Number(verse)
  if (!/^[A-Z0-9]{3}\.\d+$/.test(base) || verseNumber < 1) return ""
  var passage = base + "." + verseNumber
  var prefixLengths = linkedVerseTextLengths(formattedPrefix)
  var offset = Number(prefixLengths[String(verseNumber)] || 0)
  var items = highlights && typeof highlights.length === "number" ? highlights : []
  for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
    var item = items[itemIndex] || {}
    var itemPassage = String(item.passage || item.passage_id || "").toUpperCase()
    var ranges = item.selectionRanges && typeof item.selectionRanges.length === "number"
      ? item.selectionRanges
      : []
    if (ranges.length === 0 && highlightContainsVerse(item, passage)) return itemPassage
    for (var rangeIndex = 0; rangeIndex < ranges.length; rangeIndex++) {
      var range = ranges[rangeIndex] || {}
      if (String(range.passage || "").toUpperCase() !== passage) continue
      if (offset >= Number(range.start) && offset < Number(range.end)) return itemPassage
    }
  }
  return ""
}

function cssColor(value) {
  var color = String(value || "").trim()
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{8}$/i.test(color)) {
    var alpha = parseInt(color.slice(1, 3), 16) / 255
    var red = parseInt(color.slice(3, 5), 16)
    var green = parseInt(color.slice(5, 7), 16)
    var blue = parseInt(color.slice(7, 9), 16)
    return "rgba(" + red + "," + green + "," + blue + "," + alpha.toFixed(3) + ")"
  }
  return ""
}

function cssFontFamily(value) {
  var family = String(value || "").trim()
  if (!family) return "'Source Serif 4',serif"
  return "'" + family.replace(/[^A-Za-z0-9 _.,+-]/g, "") + "'"
}

function linkedVerseFragments(content, verse, style) {
  var source = String(content || "")
  var blockPattern = /(<\/?(?:div|p|li|blockquote|h[1-6])\b[^>]*>)/gi
  var result = ""
  var cursor = 0
  var linkEnabled = true
  var match
  while ((match = blockPattern.exec(source)) !== null) {
    var fragment = source.slice(cursor, match.index)
    if (fragment !== "") {
      result += linkEnabled
        ? "<a href=\"light-verse:" + verse + "\" style=\"" + style + "\">"
          + fragment + "</a>"
        : fragment
    }
    result += match[0]
    if (/^<\//.test(match[0])) {
      linkEnabled = true
    } else {
      linkEnabled = !/\bclass=["'][^"']*\byv-h\b/i.test(match[0])
    }
    cursor = match.index + match[0].length
  }
  var tail = source.slice(cursor)
  if (tail !== "") {
    result += linkEnabled
      ? "<a href=\"light-verse:" + verse + "\" style=\"" + style + "\">"
        + tail + "</a>"
      : tail
  }
  return result
}

function selectedRangeHtml(content, ranges, background) {
  var source = String(content || "")
  if (!ranges || ranges.length === 0) return source
  var normalized = ranges.slice().sort(function(a, b) { return a.start - b.start })
  var result = ""
  var position = 0
  var suppressedTag = ""
  var tokenPattern = /<[^>]*>|&(?:#x[0-9a-f]+|#\d+|[a-z]+);|[^<&]+|[<&]/gi
  var match
  while ((match = tokenPattern.exec(source)) !== null) {
    var token = match[0]
    if (token.charAt(0) === "<") {
      var heading = token.match(/^<(div|p|li|blockquote|h[1-6])\b[^>]*\bclass=["'][^"']*\byv-h\b/i)
      if (heading) suppressedTag = heading[1].toLowerCase()
      result += token
      if (suppressedTag && new RegExp("^</" + suppressedTag + "\\b", "i").test(token)) {
        suppressedTag = ""
      }
      continue
    }
    if (suppressedTag) {
      result += token
      continue
    }

    var tokenLength = token.charAt(0) === "&" ? 1 : decodedText(token).length
    var tokenStart = position
    var tokenEnd = position + tokenLength
    var cursor = 0
    for (var rangeIndex = 0; rangeIndex < normalized.length; rangeIndex++) {
      var range = normalized[rangeIndex]
      var overlapStart = Math.max(tokenStart, range.start)
      var overlapEnd = Math.min(tokenEnd, range.end)
      if (overlapEnd <= overlapStart) continue
      var localStart = overlapStart - tokenStart
      var localEnd = overlapEnd - tokenStart
      if (localStart > cursor) result += token.slice(cursor, localStart)
      result += "<span style=\"background-color:" + background + ";\">"
        + token.slice(localStart, localEnd) + "</span>"
      cursor = localEnd
    }
    result += token.slice(cursor)
    position = tokenEnd
  }
  return result
}

function decorateVerses(content, highlights, foregroundColor, highlightOpacity) {
  var source = String(content || "")
  var markerPattern = /<span\b[^>]*class=["'][^"']*\byv-v\b[^"']*["'][^>]*>\s*<\/span>/gi
  var specs = highlightVerseSpecs(highlights, highlightOpacity)
  var foreground = cssColor(foregroundColor)
  var markers = []
  var markerMatch
  while ((markerMatch = markerPattern.exec(source)) !== null) {
    var verseMatch = markerMatch[0].match(/\bv=["'](\d+)["']/i)
    if (verseMatch) {
      markers.push({
        index: markerMatch.index,
        html: markerMatch[0],
        verse: String(verseMatch[1])
      })
    }
  }
  if (markers.length === 0) return source

  var result = ""
  result += source.slice(0, markers[0].index)
  for (var markerIndex = 0; markerIndex < markers.length; markerIndex++) {
    var marker = markers[markerIndex]
    var segmentStart = marker.index + marker.html.length
    var segmentEnd = markerIndex + 1 < markers.length
      ? markers[markerIndex + 1].index
      : source.length
    var segment = source.slice(segmentStart, segmentEnd)
    var verse = marker.verse
    var spec = specs[verse]
    var style = "text-decoration:none;"
    if (foreground) style += "color:" + foreground + ";"
    var verseContent = marker.html + segment
    if (spec && spec.ranges.length > 0) {
      verseContent = selectedRangeHtml(verseContent, spec.ranges, spec.background)
    } else if (spec) {
      style += "background-color:" + spec.background + ";"
    }
    result += linkedVerseFragments(verseContent, verse, style)
  }
  return result
}

function displayHtml(
  content,
  basePixelSize,
  highlights,
  foregroundColor,
  fontFamily,
  redLetters,
  redLetterColor,
  highlightOpacity
) {
  var foreground = cssColor(foregroundColor)
  var wordsOfJesus = redLetters === true
    ? (cssColor(redLetterColor) || "#94000c")
    : ""
  var body = decorateVerses(
    addNbspToVerseLabels(richText(content)), highlights, foreground, highlightOpacity
  )
  if (!body) return ""
  var size = Number(basePixelSize)
  if (!isFinite(size) || size <= 0) size = 18
  size = Math.round(size)
  var verse = Math.max(9, Math.round(size * 0.66))
  var note = Math.max(9, Math.round(size * 0.76))
  var css = [
    "<style>",
    ".id,.ide,.usfm,.h,.sts,.rem,.toc1,.toc2,.toc3,.toca1,.toca2,.toca3,.ie,.mte,.cl,.x{display:none;}",
    ".yv-h{font-weight:600;text-indent:0;}",
    ".mt,.mt1,.imte,.imte1{display:block;font-size:1.6em;font-weight:bold;line-height:1.4;margin:1em 0 0.25em 0;}",
    ".mt2,.imte2{display:block;font-size:1.3em;font-style:italic;line-height:1.4;margin:0.5em 0 0.15em 0;}",
    ".mt3{display:block;font-size:1.3em;font-weight:bold;line-height:1.4;margin:0.15em 0;}",
    ".mt4{display:block;line-height:1.8;margin:0.15em 0;}",
    ".imt,.is{display:block;font-size:1.17em;font-weight:600;text-align:center;}",
    ".imt1,.is1{display:block;font-size:1.17em;font-weight:bold;line-height:1.8;margin:0.5em 0;}",
    ".imt2{display:block;font-size:1.08em;font-style:italic;line-height:1.8;margin:0.5em 0 0.25em 0;}",
    ".imt3,.is2{display:block;font-weight:bold;line-height:1.8;margin:0.15em 0;}",
    ".imt4{display:block;font-style:italic;line-height:1.8;margin:0.15em 0;}",
    ".ms{display:block;font-weight:600;text-align:center;margin:0 0 0.6em 0;}",
    ".ms1{display:block;font-size:1.17em;font-weight:600;text-align:center;margin:0.5em 0;}",
    ".ms2,.ms3,.ms4{display:block;font-weight:600;text-align:center;margin:0.5em 0;}",
    ".mr{display:block;font-size:1.17em;font-weight:600;font-style:italic;text-align:center;margin:0 0 0.6em 0;}",
    ".s,.s1{display:block;font-size:1.17em;font-weight:600;margin:0 0 0.25em 0;}",
    ".s2,.s3,.s4{display:block;font-weight:600;font-style:italic;margin:0.5em 0;}",
    ".sr{display:block;font-weight:bold;line-height:1.8;margin:0 0 0.5em 0;}",
    ".r{display:block;font-weight:normal;font-style:italic;line-height:1.8;margin:0 0 0.5em 0;}",
    ".sp,.qa{display:block;font-size:1.17em;font-weight:600;font-style:italic;margin:0.5em 0;text-indent:0;}",
    ".d{display:block;font-style:italic;text-align:center;margin:0.6em 0 1.2em 0;}",
    ".p,.ip{display:block;text-indent:1em;margin:0 0 0.6em 0;}",
    ".m,.im,.pi{display:block;text-indent:0;margin:0.5em 0;}",
    ".nb{display:block;text-indent:0;}",
    ".pi1{display:block;text-indent:1em;margin-left:1em;margin-bottom:0.6em;}",
    ".pi2{display:block;text-indent:1em;margin-left:2em;}.pi3{display:block;text-indent:1em;margin-left:3em;}",
    ".mi{display:block;text-indent:0;margin-left:1em;}",
    ".pm,.pmo,.pmc{display:block;text-indent:0;margin:0.5em 0 0.5em 1em;}",
    ".pmr,.pr,.ipr,.cls{display:block;text-align:right;margin:0.5em 0;}",
    ".pc{display:block;text-align:center;font-variant:small-caps;margin-bottom:0.6em;}",
    ".po{display:block;text-indent:1em;margin-bottom:0.5em;}",
    ".q{display:block;margin-left:2em;text-indent:-2em;margin-bottom:0.3em;}",
    ".q1,.iq1{display:block;margin-left:1em;text-indent:0;}",
    ".q2,.iq2{display:block;margin-left:2em;text-indent:0;}",
    ".q3,.iq3{display:block;margin-left:3em;text-indent:0;}",
    ".q4,.iq4{display:block;margin-left:4em;text-indent:0;}",
    ".qc{display:block;text-align:center;margin:0;text-indent:0;}.qr{display:block;text-align:right;font-style:italic;}",
    ".qm{display:block;text-indent:0;margin:0.5em 0;}",
    ".qm1{display:block;margin:0.5em 0 0.5em 1em;}.qm2{display:block;margin:0.5em 0 0.5em 2em;}",
    ".qm3{display:block;margin:0.5em 0 0.5em 3em;}.qm4{display:block;margin:0.5em 0 0.5em 4em;}",
    ".b,.ib,.sd,.lb{display:block;height:1em;}",
    ".li,.ph,.ph1{display:block;margin-left:2em;text-indent:-1.5em;}",
    ".li1,.ili,.ili1{display:block;margin-left:1em;text-indent:0;}",
    ".li2,.ili2{display:block;margin-left:2em;text-indent:0;}",
    ".li3,.ili3{display:block;margin-left:3em;text-indent:0;}",
    ".li4,.ili4{display:block;margin-left:4em;text-indent:0;}",
    ".io,.io1{display:block;margin-left:2em;}.io2{display:block;margin-left:3em;}",
    ".io3{display:block;margin-left:4em;}.io4{display:block;margin-left:5em;}",
    ".yv-vlbl{font-size:" + verse + "px;font-weight:600;vertical-align:super;white-space:nowrap;}",
    ".yv-n{font-size:" + note + "px;font-style:italic;}",
    ".wj{" + (wordsOfJesus ? "color:" + wordsOfJesus + ";" : "") + "}",
    "a{text-decoration:none;" + (foreground ? "color:" + foreground + ";" : "") + "}",
    ".it,.em,.tl,.fq,.fqa,.sls,.qt,.sig,.dc,.fdc,.add,.bk,.qs,.qac{font-style:italic;}",
    ".bd,.k{font-weight:bold;}.bdit,.k{font-style:italic;}.bdit{font-weight:600;}",
    ".nd,.sc{font-variant:small-caps;}.rq{font-size:0.8em;font-style:italic;}",
    "table{width:100%;margin:0.75em 0 1em 0;border-collapse:collapse;}",
    "td,.tc,th,.th,.th1,.tcr,.tcr1,.thr,.thr1{padding:0.25em;vertical-align:top;}",
    "th,.th,.th1,.thr,.thr1{font-weight:bold;}.tcr,.tcr1,.thr,.thr1{text-align:right;}",
    "</style>"
  ].join("")
  return css + "<div style=\"font-family:" + cssFontFamily(fontFamily) + ";font-size:" + size + "px;line-height:168%;"
    + (foreground ? "color:" + foreground + ";" : "") + "\">" + body + "</div>"
}

function plainText(content) {
  return String(content || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, function(_, code) { return String.fromCharCode(Number(code)) })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function citation(reference, versionLabel) {
  var ref = String(reference || "").trim()
  var version = String(versionLabel || "").trim()
  if (!ref) return version
  return version ? ref + " (" + version + ")" : ref
}

function shareText(content, reference, versionLabel) {
  var body = plainText(content)
  var cite = citation(reference, versionLabel)
  return [body, cite].filter(function(value) { return value !== "" }).join("\n\n")
}

function shareHtml(content, reference, versionLabel) {
  var body = richText(content)
  var cite = citation(reference, versionLabel)
  return body + (cite ? "<p><cite>" + escapeHtml(cite) + "</cite></p>" : "")
}
