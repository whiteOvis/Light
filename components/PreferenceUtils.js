.pragma library

function clampedScale(value, fallback, minimum, maximum) {
  var scale = Number(value)
  if (!isFinite(scale)) scale = fallback
  return Math.round(Math.max(minimum, Math.min(maximum, scale)) * 100) / 100
}

function appScale(value) {
  return clampedScale(value, 1.2, 0.8, 1.6)
}

function readerTextScale(value) {
  return clampedScale(value, 1, 0.7, 1.8)
}

function readerFontStyle(value) {
  return String(value || "").toLowerCase() === "system" ? "system" : "youversion"
}

function saveRevision(tag, prefix) {
  var suffix = String(tag || "").slice(String(prefix || "").length)
  var separator = suffix.indexOf(":")
  var revision = Number(separator < 0 ? suffix : suffix.slice(0, separator))
  return isFinite(revision) ? revision : 0
}

function customRadioStations(value, fallbackDescription) {
  if (!Array.isArray(value)) return []
  var result = []
  var seen = ({})
  for (var i = 0; i < value.length; i++) {
    var station = value[i] || {}
    var name = String(station.name || "").trim()
    var streamUrl = String(station.streamUrl || "").trim()
    var key = streamUrl.toLowerCase()
    if (!name || !/^https?:\/\/[^\s]+$/i.test(streamUrl) || seen[key]) continue
    seen[key] = true
    result.push({
      name: name,
      description: String(station.description || fallbackDescription || "Custom station"),
      streamUrl: streamUrl,
      siteUrl: "",
      custom: true
    })
  }
  return result
}

function hiddenRadioStationIds(value) {
  if (!Array.isArray(value)) return []
  var result = []
  var seen = ({})
  for (var i = 0; i < value.length; i++) {
    var stationId = String(value[i] || "").trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(stationId) || seen[stationId]) continue
    seen[stationId] = true
    result.push(stationId)
  }
  return result
}

function radioStationOrder(value) {
  if (!Array.isArray(value)) return []
  var result = []
  var seen = ({})
  for (var i = 0; i < value.length; i++) {
    var stationKey = String(value[i] || "").trim().toLowerCase()
    var builtInKey = /^builtin:[a-z0-9][a-z0-9-]{0,63}$/.test(stationKey)
    var customKey = /^custom:https?:\/\/\S{1,512}$/.test(stationKey)
    if ((!builtInKey && !customKey) || seen[stationKey]) continue
    seen[stationKey] = true
    result.push(stationKey)
  }
  return result
}

function secondaryBibleLanguages(value, primaryLanguage) {
  if (!Array.isArray(value)) return []
  var result = []
  var seen = ({})
  var primary = String(primaryLanguage || "")
  for (var i = 0; i < value.length; i++) {
    var language = String(value[i] || "")
    if (!language || language === primary || seen[language]) continue
    seen[language] = true
    result.push(language)
  }
  return result
}
