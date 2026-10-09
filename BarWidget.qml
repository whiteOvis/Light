import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "components"

BarWidget {
  id: root
  moduleName: "light.bible-reader"

  readonly property alias panelAnchorItem: button
  readonly property var panel: LightSession.panel
  readonly property bool ownsPanel: panel && panel.hostWidget === root
  readonly property bool opened: ownsPanel && panel.opened
  readonly property bool popoutSwitchClosing: ownsPanel && panel.popoutSwitchClosing

  function injectPanel() {
    if (ownsPanel) LightSession.attach(root)
  }

  Component.onCompleted: LightSession.registerWidget(root)
  Component.onDestruction: LightSession.unregisterWidget(root)

  // The bar uses these dimensions for the small open-panel indicator.
  readonly property real openPanelIndicatorWidth: Style.bar.iconSlot
  readonly property real openPanelIndicatorHeight: Math.max(
    Style.space(3),
    Math.round(Style.bar.iconSlot * 0.12)
  )

  function open() {
    LightSession.attach(root)
    if (!root.panel) return
    if (root.panel.radioPlayer && (root.panel.radioPlayer.playing || root.panel.radioPlayer.paused))
      root.panel.openRadio()
    else root.panel.open()
  }

  function close() {
    if (root.ownsPanel) root.panel.close()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function closeForPopoutSwitch() {
    if (root.ownsPanel) root.panel.closeForPopoutSwitch()
  }

  function openVerseOfTheDay() {
    LightSession.attach(root)
    var target = root.panel
    if (target && "openVerseOfTheDay" in target)
      target.openVerseOfTheDay()
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  IpcHandler {
    target: "light.bible-reader"

    function verseOfTheDay(): string {
      root.openVerseOfTheDay()
      return "ok"
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    active: root.opened
    activeColor: Color.bar.active
    slotSize: Style.bar.iconSlot
    tooltipText: "Light"

    iconComponent: Component {
      RomanCrossIcon {
        // Light's bar identity mark remains white across all Omarchy themes.
        color: "#ffffff"
      }
    }

    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) root.toggle()
      else if (mouseButton === Qt.RightButton) root.openVerseOfTheDay()
    }
  }
}
