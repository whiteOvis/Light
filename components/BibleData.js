.pragma library

var BOOKS = [
  ["GEN", "Genesis", 50], ["EXO", "Exodus", 40], ["LEV", "Leviticus", 27],
  ["NUM", "Numbers", 36], ["DEU", "Deuteronomy", 34], ["JOS", "Joshua", 24],
  ["JDG", "Judges", 21], ["RUT", "Ruth", 4], ["1SA", "1 Samuel", 31],
  ["2SA", "2 Samuel", 24], ["1KI", "1 Kings", 22], ["2KI", "2 Kings", 25],
  ["1CH", "1 Chronicles", 29], ["2CH", "2 Chronicles", 36], ["EZR", "Ezra", 10],
  ["NEH", "Nehemiah", 13], ["EST", "Esther", 10], ["JOB", "Job", 42],
  ["PSA", "Psalms", 150], ["PRO", "Proverbs", 31], ["ECC", "Ecclesiastes", 12],
  ["SNG", "Song of Songs", 8], ["ISA", "Isaiah", 66], ["JER", "Jeremiah", 52],
  ["LAM", "Lamentations", 5], ["EZK", "Ezekiel", 48], ["DAN", "Daniel", 12],
  ["HOS", "Hosea", 14], ["JOL", "Joel", 3], ["AMO", "Amos", 9],
  ["OBA", "Obadiah", 1], ["JON", "Jonah", 4], ["MIC", "Micah", 7],
  ["NAM", "Nahum", 3], ["HAB", "Habakkuk", 3], ["ZEP", "Zephaniah", 3],
  ["HAG", "Haggai", 2], ["ZEC", "Zechariah", 14], ["MAL", "Malachi", 4],
  ["MAT", "Matthew", 28], ["MRK", "Mark", 16], ["LUK", "Luke", 24],
  ["JHN", "John", 21], ["ACT", "Acts", 28], ["ROM", "Romans", 16],
  ["1CO", "1 Corinthians", 16], ["2CO", "2 Corinthians", 13], ["GAL", "Galatians", 6],
  ["EPH", "Ephesians", 6], ["PHP", "Philippians", 4], ["COL", "Colossians", 4],
  ["1TH", "1 Thessalonians", 5], ["2TH", "2 Thessalonians", 3], ["1TI", "1 Timothy", 6],
  ["2TI", "2 Timothy", 4], ["TIT", "Titus", 3], ["PHM", "Philemon", 1],
  ["HEB", "Hebrews", 13], ["JAS", "James", 5], ["1PE", "1 Peter", 5],
  ["2PE", "2 Peter", 3], ["1JN", "1 John", 5], ["2JN", "2 John", 1],
  ["3JN", "3 John", 1], ["JUD", "Jude", 1], ["REV", "Revelation", 22]
]

// Society of Biblical Literature book abbreviations, compacted by removing
// the internal space after a leading number for narrow tab labels.
var BOOK_ABBREVIATIONS = ({
  GEN: "Gen", EXO: "Exod", LEV: "Lev", NUM: "Num", DEU: "Deut", JOS: "Josh",
  JDG: "Judg", RUT: "Ruth", "1SA": "1Sam", "2SA": "2Sam", "1KI": "1Kgs",
  "2KI": "2Kgs", "1CH": "1Chr", "2CH": "2Chr", EZR: "Ezra", NEH: "Neh",
  EST: "Esth", JOB: "Job", PSA: "Ps", PRO: "Prov", ECC: "Eccl", SNG: "Song",
  ISA: "Isa", JER: "Jer", LAM: "Lam", EZK: "Ezek", DAN: "Dan", HOS: "Hos",
  JOL: "Joel", AMO: "Amos", OBA: "Obad", JON: "Jonah", MIC: "Mic", NAM: "Nah",
  HAB: "Hab", ZEP: "Zeph", HAG: "Hag", ZEC: "Zech", MAL: "Mal", MAT: "Matt",
  MRK: "Mark", LUK: "Luke", JHN: "John", ACT: "Acts", ROM: "Rom", "1CO": "1Cor",
  "2CO": "2Cor", GAL: "Gal", EPH: "Eph", PHP: "Phil", COL: "Col", "1TH": "1Thess",
  "2TH": "2Thess", "1TI": "1Tim", "2TI": "2Tim", TIT: "Titus", PHM: "Phlm",
  HEB: "Heb", JAS: "Jas", "1PE": "1Pet", "2PE": "2Pet", "1JN": "1John",
  "2JN": "2John", "3JN": "3John", JUD: "Jude", REV: "Rev"
})

function bookAbbreviation(value) {
  var code = String(value || "").toUpperCase()
  return BOOK_ABBREVIATIONS[code] || code
}

function bookOptions() {
  var result = []
  for (var i = 0; i < BOOKS.length; i++) {
    result.push({
      value: BOOKS[i][0],
      label: BOOKS[i][1],
      description: BOOKS[i][0],
      chapters: BOOKS[i][2]
    })
  }
  return result
}

function defaultVersionOptions() {
  return []
}

function chapterOptions(bookValue, options) {
  var books = options || bookOptions()
  var count = 0
  for (var i = 0; i < books.length; i++) {
    if (String(books[i].value) === String(bookValue)) {
      count = Number(books[i].chapters) || 0
      break
    }
  }

  var result = []
  for (var chapter = 1; chapter <= count; chapter++) {
    result.push({
      value: String(chapter),
      label: "Chapter " + chapter,
      description: String(chapter)
    })
  }
  return result
}

function adjacentChapter(options, currentValue, direction) {
  var chapters = options || []
  var step = Number(direction) < 0 ? -1 : 1
  var current = String(currentValue || "")
  for (var i = 0; i < chapters.length; i++) {
    var value = chapters[i] && typeof chapters[i] === "object"
      ? String(chapters[i].value)
      : String(chapters[i])
    if (value !== current) continue
    var target = i + step
    return target >= 0 && target < chapters.length ? chapters[target] : null
  }
  return null
}

function searchableText(option) {
  if (option === null || option === undefined) return ""
  if (typeof option !== "object") return String(option).toLowerCase()
  var aliases = option.aliases instanceof Array ? option.aliases.join(" ") : ""
  return [option.label, option.description, option.value, aliases]
    .join(" ")
    .toLowerCase()
}

function filterOptions(options, query) {
  var source = options || []
  var needle = String(query || "").trim().toLowerCase()
  if (!needle) return source.slice(0)

  var exact = []
  var prefix = []
  var wordPrefix = []
  var contains = []
  for (var i = 0; i < source.length; i++) {
    var option = source[i]
    var label = option && typeof option === "object" ? String(option.label || "") : String(option)
    var value = option && typeof option === "object" ? String(option.value || "") : String(option)
    var aliases = option && option.aliases instanceof Array ? option.aliases : []
    var candidates = [label, value].concat(aliases)
    var rank = 4
    for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
      var candidate = String(candidates[candidateIndex] || "").toLowerCase()
      if (candidate === needle) rank = Math.min(rank, 0)
      else if (candidate.indexOf(needle) === 0) rank = Math.min(rank, 1)
      var words = candidate.split(/\s+/)
      for (var word = 0; word < words.length; word++) {
        if (words[word].indexOf(needle) === 0) rank = Math.min(rank, 2)
      }
    }
    if (rank === 4 && searchableText(option).indexOf(needle) !== -1) rank = 3
    if (rank === 0) exact.push(option)
    else if (rank === 1) prefix.push(option)
    else if (rank === 2) wordPrefix.push(option)
    else if (rank === 3) contains.push(option)
  }
  return exact.concat(prefix, wordPrefix, contains)
}

function normalizeReferenceText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^([1-3]?[a-z]+)\.(\d+)\.(\d+)/, "$1 $2:$3")
    .replace(/^([1-3])(?=[a-z])/, "$1 ")
    .replace(/\s*:\s*/g, ":")
    .replace(/[.,;|]+/g, " ")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
}

function optionTerms(option) {
  if (!option || typeof option !== "object") return [String(option || "")]
  var result = [option.label, option.value, option.description]
  if (option.aliases instanceof Array) result = result.concat(option.aliases)
  var code = String(option.value || "").toUpperCase()
  if (BOOK_ABBREVIATIONS[code]) result.push(BOOK_ABBREVIATIONS[code])
  if (code === "PSA") result.push("Psalm")
  return result
}

function prefixedOption(options, normalizedInput) {
  var source = options || []
  var best = null
  var bestTerm = ""
  for (var i = 0; i < source.length; i++) {
    var terms = optionTerms(source[i])
    for (var termIndex = 0; termIndex < terms.length; termIndex++) {
      var term = normalizeReferenceText(terms[termIndex])
      if (!term) continue
      if (normalizedInput !== term && normalizedInput.indexOf(term + " ") !== 0
          && !(normalizedInput.indexOf(term) === 0 && /^\d/.test(normalizedInput.slice(term.length))))
        continue
      if (term.length > bestTerm.length) {
        best = source[i]
        bestTerm = term
      }
    }
  }
  return { option: best, term: bestTerm }
}

// Parse the Book field as either a book search or a complete reference. This
// intentionally targets Light's chapter reader while accepting common spacing
// and punctuation styles such as "Acts 5", "ACT.5", and
// "1 John chapter 3" with a selected catalog translation.
function parseReferenceInput(query, books, versions) {
  var normalized = normalizeReferenceText(query)
  var matched = prefixedOption(books || [], normalized)
  var leadingVersion = null
  if (!matched.option) {
    var prefix = prefixedOption(versions || [], normalized)
    if (prefix.option) {
      var afterVersion = normalized.slice(prefix.term.length).trim()
      var followingBook = prefixedOption(books || [], afterVersion)
      if (followingBook.option) {
        leadingVersion = prefix.option
        normalized = afterVersion
        matched = followingBook
      }
    }
  }
  if (!matched.option) {
    return {
      book: null,
      bookQuery: normalized,
      chapter: "",
      chapterValid: false,
      versionQuery: "",
      version: null,
      compound: false
    }
  }

  var remainder = normalized.slice(matched.term.length).trim()
  remainder = remainder.replace(/^(?:chapter|cap[ií]tulo)\s+/i, "")
  remainder = remainder.replace(/^(\d+)\s+(?:verse|verses|v|vv|vers[ií]culo)\s*(\d+)/i, "$1:$2")
  var chapterMatch = remainder.match(/^(\d+)(?::(\d+)(?:-(\d+))?)?(?:\s*(\D.*))?$/)
  if (!chapterMatch) chapterMatch = remainder.match(/^(\d+)(?::(\d+)(?:-(\d+))?)?\s+(\d+)$/)
  var chapter = chapterMatch ? String(Number(chapterMatch[1])) : ""
  var versionQuery = chapterMatch ? String(chapterMatch[4] || "").trim() : ""
  var chapterCount = Number(matched.option.chapters) || 0
  var chapterNumber = Number(chapter)
  var chapterValid = chapter !== ""
    && chapterNumber >= 1
    && (chapterCount === 0 || chapterNumber <= chapterCount)

  return {
    book: matched.option,
    bookQuery: matched.term || normalized,
    chapter: chapter,
    verse: chapterMatch && chapterMatch[2] ? String(Number(chapterMatch[2])) : "",
    verseValid: !chapterMatch || !chapterMatch[2] || (Number(chapterMatch[2]) > 0
      && (!chapterMatch[3] || Number(chapterMatch[3]) >= Number(chapterMatch[2]))),
    chapterValid: chapterValid,
    versionQuery: versionQuery,
    version: versionQuery === ""
      ? leadingVersion
      : (prefixedOption(versions || [], versionQuery).term === versionQuery
        ? prefixedOption(versions || [], versionQuery).option
        : autocompleteOption(versions || [], versionQuery)),
    compound: remainder !== ""
  }
}

function autocompleteOption(options, query) {
  var source = options || []
  var needle = String(query || "").trim().toLowerCase()
  if (!needle) return null

  var exact = null
  var prefix = null
  var wordPrefix = null
  var contains = null

  for (var i = 0; i < source.length; i++) {
    var option = source[i]
    var label = option && typeof option === "object" ? String(option.label || "") : String(option)
    var value = option && typeof option === "object" ? String(option.value || "") : String(option)
    var lowerLabel = label.toLowerCase()
    var lowerValue = value.toLowerCase()

    if (lowerLabel === needle || lowerValue === needle) {
      exact = option
      break
    }
    if (prefix === null && (lowerLabel.indexOf(needle) === 0 || lowerValue.indexOf(needle) === 0))
      prefix = option
    if (wordPrefix === null) {
      var words = lowerLabel.split(/\s+/)
      for (var word = 0; word < words.length; word++) {
        if (words[word].indexOf(needle) === 0) {
          wordPrefix = option
          break
        }
      }
    }
    if (contains === null && searchableText(option).indexOf(needle) !== -1)
      contains = option
  }

  return exact || prefix || wordPrefix || contains
}

function autocompleteSuffix(option, query) {
  if (!option) return ""
  var typed = String(query || "")
  var candidates = option && typeof option === "object"
    ? [option.label, option.description, option.value]
    : [option]
  for (var i = 0; i < candidates.length; i++) {
    var candidate = String(candidates[i] || "")
    if (candidate.toLowerCase().indexOf(typed.toLowerCase()) === 0)
      return candidate.slice(typed.length)
  }
  return ""
}
