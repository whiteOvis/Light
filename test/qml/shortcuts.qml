import QtQuick
import QtTest
import "plugin"
TestCase {
 id: test
 name: "LightShortcuts"
 visible: true
 when: windowShown
 width: 1050; height: 950
 property var defaults: /*DEFAULTS*/
 property var panel
 property var view
 property string dispatched: ""
 Component { id: factory; Panel { onShortcutDispatched: function(name) { test.dispatched = name } } }
 function equal(actual, expected, label) {
  if(actual !== expected) console.error("SHORTCUT_FAILURE",label || "",JSON.stringify(actual),"expected",JSON.stringify(expected))
  compare(actual,expected,label)
 }
 function check(value, label) {
  if(!value) console.error("SHORTCUT_FAILURE",label || "verification")
  verify(value,label)
 }
 function init() {
  panel = factory.createObject(test, {accountAuthenticated:true})
  check(panel !== null)
  view = findChild(panel,"lightView")
  check(view !== null)
  panel.controller.show()
  view.forceActiveFocus()
  wait(20)
  dispatched = ""
 }
 function cleanup() { panel.destroy(); wait(20) }
 function setup(name) {
  if (name.indexOf("radio") === 0 || name === "openRadio" || name === "cycleRadioSkin") {
   panel.musicPlayerEnabled = true
   if (name.indexOf("radio") === 0) {
    panel.openRadio()
    tryVerify(function() { return panel.radioPlayer !== null })
    panel.radioPlayer.volume = 0
    panel.radioPlayer.forceActiveFocus()
   }
  }
  if (["newTab","closeTab","nextTab","previousTab"].indexOf(name)>=0 || /^tab\d$/.test(name)) {
   view.tabs = /^tab\d$/.test(name) ? Array.from({length:7},function(_,i) {return {version:"111",passage:"JHN."+(i+1)}}) : [{version:"111",passage:"JHN.3"},{version:"111",passage:"PSA.23"}]
   view.activeTabIndex = 0
  }
 }
 function click(sequence, translated) {
  var parts=sequence.split("+"); var key=parts.pop(); if (key === "") { key="+"; parts.pop() }; var mods=Qt.NoModifier
  parts.forEach(function(p) { mods |= p==="Ctrl" ? Qt.ControlModifier : p==="Shift" ? Qt.ShiftModifier : p==="Alt" ? Qt.AltModifier : Qt.MetaModifier })
  var keys={Escape:Qt.Key_Escape,Tab:Qt.Key_Tab,Backspace:Qt.Key_Backspace,Left:Qt.Key_Left,Right:Qt.Key_Right,Up:Qt.Key_Up,Down:Qt.Key_Down,Space:Qt.Key_Space}
  if(translated && (mods & Qt.ShiftModifier) && /^[1-7]$/.test(key)) key="!@#$%^&"[Number(key)-1]
  if(translated && key==="Tab" && (mods & Qt.ShiftModifier)) key="Backtab"
  keyClick(key==="Backtab" ? Qt.Key_Backtab : keys[key] || key.toUpperCase().charCodeAt(0),mods,0)
  wait(10)
 }
 function test_allShortcuts_data() {
  var rows=[]
  Object.keys(defaults).forEach(function(name) {
   if(["globalToggle","verseOfTheDay","radioVolumeDown","radioVolumeUp"].indexOf(name)>=0) return
   rows.push({tag:name,name:name,sequence:defaults[name],translated:false})
   if(/Shift\+[1-7]$/.test(defaults[name]) || name==="previousTab") rows.push({tag:name+"-translated",name:name,sequence:defaults[name],translated:true})
  })
  return rows
 }
 function test_allShortcuts(row) {
  setup(row.name)
  panel.previewBrightness(0.7)
  var before={text:panel.readerTextScale, app:panel.appScale, brightness:panel.textBrightness,
    font:panel.readerFontStyle, night:panel.studyOptions.nightMode, skin:panel.studyOptions.radioSkin,
    station:panel.radioPlayer ? panel.radioPlayer.currentStationIndex : 0}
  click(row.sequence,row.translated)
  var expected=row.name.replace(/^(textIncrease|textDecrease|appIncrease|appDecrease|brightnessIncrease|brightnessDecrease)(Up|Down|Left|Right)$/,"$1")
  equal(dispatched,expected,row.name+" must dispatch its action")
  if(/^tab\d$/.test(row.name)) equal(view.activeTabIndex,Number(row.name.slice(3))-1)
  if(row.name==="newTab") equal(view.tabs.length,3)
  if(row.name==="closeTab") equal(view.tabs.length,1)
  if(row.name==="nextTab" || row.name==="previousTab") equal(view.activeTabIndex,1)
  if(expected.indexOf("textIncrease")===0) check(panel.readerTextScale>before.text)
  if(expected.indexOf("textDecrease")===0) check(panel.readerTextScale<before.text)
  if(expected.indexOf("appIncrease")===0) check(panel.appScale>before.app)
  if(expected.indexOf("appDecrease")===0) check(panel.appScale<before.app)
  if(expected.indexOf("brightnessIncrease")===0) check(panel.textBrightness>before.brightness)
  if(expected.indexOf("brightnessDecrease")===0) check(panel.textBrightness<before.brightness)
  if(expected==="toggleReaderFontStyle") check(panel.readerFontStyle!==before.font)
  if(expected==="toggleNightMode") check(panel.studyOptions.nightMode!==before.night)
  if(expected==="openLibrary" || expected==="openHistory") {
   tryVerify(function() { return view.studyOpened })
   equal(view.studyPanel.mode,expected==="openLibrary" ? "library" : "history")
  }
  if(expected==="openRadio") check(panel.radioOpened)
  if(expected==="cycleRadioSkin") check(panel.studyOptions.radioSkin!==before.skin)
  if(expected.indexOf("settings")===0 || expected==="openSettings") {
   tryVerify(function() { return panel.settingsOpened })
   var page=expected==="openSettings" ? "reading" : expected.slice(8).toLowerCase()
   equal(panel.settingsModal.settingsPage,page)
  }
  if(expected==="radioPrevious" || expected==="radioNext") check(panel.radioPlayer.currentStationIndex!==before.station)
  if(expected==="freshInput") check(view.inputItem.activeFocus)
  if(expected==="closeCurrentPage") check(!panel.opened)
 }
 function test_capturedKeyAliases_data() {
  return [{tag:"return",sequence:"Ctrl+Enter",key:Qt.Key_Return},
   {tag:"comma",sequence:"Ctrl+Comma",key:Qt.Key_Comma},
   {tag:"period",sequence:"Ctrl+Period",key:Qt.Key_Period},
   {tag:"plus-shift",sequence:"Ctrl++",key:Qt.Key_Plus,mods:Qt.ControlModifier|Qt.ShiftModifier},
   {tag:"plus-equals",sequence:"Ctrl++",key:Qt.Key_Equal,mods:Qt.ControlModifier|Qt.ShiftModifier},
   {tag:"reordered-digit",sequence:"Shift+Ctrl+9",key:Qt.Key_ParenLeft,mods:Qt.ControlModifier|Qt.ShiftModifier},
   {tag:"reordered-plus",sequence:"Shift+Ctrl++",key:Qt.Key_Equal,mods:Qt.ControlModifier|Qt.ShiftModifier}]
 }
 function test_capturedKeyAliases(row) {
  panel.keybindings=Object.assign({},defaults,{textIncrease:row.sequence})
  keyClick(row.key,row.mods || Qt.ControlModifier,0)
  wait(10)
  equal(dispatched,"textIncrease")
 }
 function test_searchFocusAndCustomBinding() {
  var input=view.inputItem
  input.forceActiveFocus()
  click(defaults.newTab)
  equal(view.tabs.length,1)
  var changed=Object.assign({},defaults,{newTab:"Ctrl+N"})
  panel.keybindings=changed
  dispatched=""
  click(defaults.newTab)
  equal(dispatched,"")
  click("Ctrl+N")
  equal(view.tabs.length,2)
 }
 function test_disabledWhileClosedOrCapturing() {
  panel.controller.hide()
  click(defaults.newTab)
  equal(view.tabs.length,0)
  panel.controller.show()
  panel.openSettings("shortcuts")
  tryVerify(function() {return panel.settingsOpened})
  panel.settingsModal.beginKeybindingCapture("openSettings")
  var before=panel.settingsModal.settingsPage
  dispatched=""
  click(defaults.settingsReading,true)
  equal(dispatched,"")
  equal(panel.settingsModal.settingsPage,before)
  panel.settingsModal.cancelKeybindingCapture()
 }
 function test_tabLimitAndLastTabClose() {
  for(var i=0;i<7;i++) click(defaults.newTab)
  equal(view.tabs.length,7)
  click(defaults.newTab)
  equal(view.tabs.length,7)
  click(defaults.tab1)
  equal(view.activeTabIndex,0)
  for(var j=0;j<7;j++) click(defaults.closeTab)
  equal(view.tabs.length,0)
  equal(view.activeTabIndex,-1)
  equal(view.selectedBook,"")
 }
 function test_newTabsAreVisibleAndIndependent() {
  view.tabs=[{version:"111",passage:"JHN.3",scrollY:80}]; view.activeTabIndex=0
  findChild(view,"bibleSelector").selectedVersion="111"
  click(defaults.newTab)
  equal(view.tabs.length,2)
  equal(view.activeTabIndex,1)
  equal(view.tabs[1].passage,"")
  check(view.tabLabel(view.tabs[1]).length>0)
  click(defaults.newTab)
  equal(view.tabs.length,3)
  click(defaults.previousTab,true)
  equal(view.activeTabIndex,1)
  click(defaults.closeTab)
  equal(view.tabs.length,2)
 }
 function test_searchKeys() {
  var selector=findChild(view,"bibleSelector")
  selector.selectedVersion="111"
  var input=view.inputItem
  input.text="John 3"
  selector.refreshSearch()
  input.forceActiveFocus()
  keyClick(Qt.Key_Return,Qt.NoModifier,0)
  equal(view.selectedBook,"JHN")
  equal(view.selectedChapter,"3")
  input.text="John gospel"
  input.cursorPosition=input.text.length
  input.forceActiveFocus()
  click("Ctrl+Backspace")
  equal(input.text.trim(),"John")
  selector.openBookPopup()
  check(view.searchSuggestionsOpen,"search suggestions open")
  keyClick(Qt.Key_Escape,Qt.NoModifier,0)
  check(!view.searchSuggestionsOpen,"Escape dismisses suggestions")
  check(panel.opened,"suggestion dismissal keeps panel open")
  input.text="John"
  input.forceActiveFocus()
  wait(20)
  var clear=findChild(view,"clearSearchButton")
  keyClick(Qt.Key_Tab,Qt.NoModifier,0)
  wait(20)
  check(!input.activeFocus,"Tab moves search focus forward")
  keyClick(Qt.Key_Backtab,Qt.ShiftModifier,0)
  wait(20)
  check(input.activeFocus,"Shift+Tab restores search focus")
 }
 function test_volumeShortcuts() {
  setup("radioPrevious")
  var radio=panel.radioPlayer
  var slider=findChild(radio,"radioVolumeSlider")
  check(slider!==null)
  slider.forceActiveFocus()
  radio.volume=0.5
  var before=radio.volume
  click(defaults.radioVolumeDown); check(radio.volume<before)
  click(defaults.radioVolumeUp); compare(Math.round(radio.volume*100),Math.round(before*100))
 }
}
