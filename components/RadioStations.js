.pragma library

// Station data is independent of the audio component so Settings can render
// and reorder stations without constructing QtMultimedia objects.
function builtInStations() {
  return [
    { id: "k-love", name: "K-LOVE", description: "Contemporary Christian pop and worship", streamUrl: "https://maestro.emfcdn.com/stream_for/k-love/airable/aac", siteUrl: "https://www.klove.com/" },
    { id: "air1", name: "Air1", description: "Non-stop worship and modern praise", streamUrl: "https://maestro.emfcdn.com/stream_for/air1/airable/aac", siteUrl: "https://www.air1.com/" },
    { id: "american-family-radio", name: "American Family Radio", description: "Christian music, news, and ministry programs", streamUrl: "https://mediaserver3.afa.net:8443/music.mp3", siteUrl: "https://afr.net/" },
    { id: "classical-catholic-radio", name: "Classical Catholic Radio", description: "Catholic sacred and classical music", streamUrl: "https://streaming.live365.com/a64105", siteUrl: "https://live365.com/station/Classical-Catholic-Radio-a64105" },
    { id: "moody-radio", name: "Moody Radio", description: "Biblical teaching, talk, and sacred music", streamUrl: "https://14123.live.streamtheworld.com/WMBIFM.mp3", siteUrl: "https://www.moodyradio.org/" },
    { id: "christianrock-net", name: "ChristianRock.Net", description: "Christian rock, metal, and alternative", streamUrl: "https://listen.christianrock.net/stream/1/", siteUrl: "https://www.christianrock.net/" },
    { id: "christian-rock-radio", name: "Christian Rock Radio", description: "High-energy rock and alternative · Skillet, Switchfoot, RED", streamUrl: "https://stream.aiir.com/evbqbacipzavv", siteUrl: "https://radiou.com/listen/" },
    { id: "cbn-radio", name: "CBN Radio", description: "Contemporary Christian music", streamUrl: "https://streams.cbnradio.com/contemporary-128K", siteUrl: "https://cbn.com/lp/cbn-radio" },
    { id: "cape-christian-radio", name: "Cape Christian Radio", description: "Classic and contemporary praise", streamUrl: "https://ice64.securenetsystems.net/CCR1MP3", siteUrl: "https://www.communitynetradio.org/" },
    { id: "christian-life-radio", name: "Christian Life Radio", description: "Christian music, scripture, and devotionals", streamUrl: "https://ice64.securenetsystems.net/CLR1MP3", siteUrl: "https://www.communitynetradio.org/christianliferadio" },
    { id: "3abn-radio-music", name: "3ABN Radio Music Channel", description: "Sacred music, hymns, and inspiration", streamUrl: "https://war.streamguys1.com:7185/MC01", siteUrl: "https://3abnplus.tv/" },
    { id: "wotr-instrumental-hymns", name: "WOTR Instrumental Hymns", description: "Calm piano, strings, and instrumental hymns", streamUrl: "http://107.150.36.50:8025/hymns", siteUrl: "https://wordoftruthradio.com/" },
    { id: "abiding-radio-instrumental", name: "Abiding Radio Instrumental", description: "Peaceful orchestral and instrumental worship", streamUrl: "https://streams.abidingradio.com:7800/instrumental", siteUrl: "https://www.abidingradio.org/listen/" },
    { id: "wotr-acoustic-praise", name: "WOTR Acoustic Praise Cafe", description: "Folk and acoustic worship", streamUrl: "https://wotrstream.com:8443/acoustic", siteUrl: "https://wordoftruthradio.com/acoustic-praise/" },
    { id: "abiding-radio-peaceful", name: "Abiding Radio Peaceful", description: "Atmospheric and soft sacred music", streamUrl: "https://streams.abidingradio.com:7850/quiet", siteUrl: "https://www.abidingradio.org/listen/" }
  ]
}

// Match the browser/Node URL normalizations that affect stream identity. This
// keeps a previously saved custom station from appearing beside a newly
// shipped built-in that points at the same stream.
function comparableStreamUrl(value) {
  var text = String(value || "").trim()
  var match = text.match(/^(https?):\/\/([^\/?#]+)([^#]*)/i)
  if (!match) return text.toLowerCase()
  var scheme = String(match[1]).toLowerCase()
  var authority = String(match[2])
  var userInfo = ""
  var at = authority.lastIndexOf("@")
  if (at >= 0) {
    userInfo = authority.slice(0, at + 1)
    authority = authority.slice(at + 1)
  }
  authority = authority.toLowerCase()
  if (scheme === "https" && /:443$/.test(authority))
    authority = authority.slice(0, -4)
  else if (scheme === "http" && /:80$/.test(authority))
    authority = authority.slice(0, -3)
  var suffix = String(match[3] || "")
  if (suffix === "" || suffix.charAt(0) === "?") suffix = "/" + suffix
  return (scheme + "://" + userInfo + authority + suffix).toLowerCase()
}

function mergedStations(visibleBuiltIns, customStations, allBuiltIns) {
  var visible = visibleBuiltIns instanceof Array ? visibleBuiltIns : []
  var custom = customStations instanceof Array ? customStations : []
  var builtIns = allBuiltIns instanceof Array ? allBuiltIns : visible
  var seen = ({})
  var result = visible.slice(0)
  for (var builtInIndex = 0; builtInIndex < builtIns.length; builtInIndex++) {
    var builtInKey = comparableStreamUrl((builtIns[builtInIndex] || {}).streamUrl)
    if (builtInKey) seen[builtInKey] = true
  }
  for (var customIndex = 0; customIndex < custom.length; customIndex++) {
    var station = custom[customIndex] || {}
    var customKey = comparableStreamUrl(station.streamUrl)
    // Retain browser-only legacy entries that have no direct stream URL.
    if (!customKey) {
      result.push(station)
      continue
    }
    if (seen[customKey]) continue
    seen[customKey] = true
    result.push(station)
  }
  return result
}
