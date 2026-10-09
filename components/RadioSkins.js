.pragma library

var SKINS = [
  { name: "Rack", radius: 2, borderWidth: 2, font: "mono", title: "rails", bevel: true,
    station: [210,40,324,90], timer: [16,40,184,90], volume: [16,137,518], transport: [16,170], playlist: 235 },
  { name: "Orbit", radius: 30, borderWidth: 1, font: "system", title: "line", bevel: false,
    station: [224,44,310,100], timer: [16,174,184,80], volume: [224,210,310], transport: [224,155], playlist: 290 },
  { name: "Stomp", radius: 10, borderWidth: 3, font: "mono", title: "block", bevel: true,
    station: [16,42,300,90], timer: [340,42,194,90], volume: [16,146,300], transport: [16,192], playlist: 290 },
  { name: "Tape", radius: 8, borderWidth: 2, font: "system", title: "clean", bevel: true,
    station: [278,40,256,100], timer: [278,146,256,80], volume: [16,240,518], transport: [16,190], playlist: 300 },
  { name: "Air", radius: 28, borderWidth: 1, font: "system", title: "pill", bevel: false,
    station: [16,38,518,84], timer: [350,156,184,80], volume: [16,240,518], transport: [16,174], playlist: 300 },
  { name: "Studio", radius: 4, borderWidth: 1, font: "mono", title: "offset", bevel: true,
    station: [16,40,280,94], timer: [16,142,184,80], volume: [16,232,518], transport: [224,180], playlist: 290 },
  { name: "Valve", radius: 14, borderWidth: 2, font: "mono", title: "clean", bevel: true,
    station: [16,40,518,82], timer: [350,138,184,80], volume: [16,278,518], transport: [16,234], playlist: 332 }
]

function normalize(value) {
  var number = Number(value)
  return Number.isInteger(number) && number >= 1 && number <= SKINS.length
    ? number
    : 1
}

function spec(value) {
  return SKINS[normalize(value) - 1]
}

function count() {
  return SKINS.length
}

function next(value, order) {
  var skins = normalizeOrder(order)
  return skins[(skins.indexOf(normalize(value)) + 1) % skins.length]
}

function normalizeOrder(value) {
  var source = value instanceof Array ? value : []
  var seen = ({})
  var result = []
  for (var i = 0; i < source.length; i++) {
    var skin = normalize(source[i])
    if (seen[skin] || Number(source[i]) !== skin) continue
    seen[skin] = true
    result.push(skin)
  }
  for (var defaultSkin = 1; defaultSkin <= SKINS.length; defaultSkin++)
    if (!seen[defaultSkin]) result.push(defaultSkin)
  return result
}
