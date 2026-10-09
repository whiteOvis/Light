pragma Singleton
import QtQuick

QtObject {
  id: root
  property var widgets: []
  property var panel: null
  property var panelFactory: null

  function registerWidget(widget) {
    if (widgets.indexOf(widget) >= 0) return
    widgets = widgets.concat([widget])
    if (!panelFactory) panelFactory = Qt.createComponent(Qt.resolvedUrl("Panel.qml"))
    if (!panel) panel = panelFactory.createObject(root)
    if (!panel) {
      console.error("Unable to create shared Light panel:", panelFactory.errorString())
      return
    }
    if (!panel.hostWidget) attach(widget)
  }

  function attach(widget) {
    if (!panel || widgets.indexOf(widget) < 0) return
    if (panel.hostWidget !== widget) {
      // Unmap the old input surface before moving its anchor to another monitor.
      panel.controller.hide()
      panel.setCenterHoverRevealSuppressed(false)
    }
    panel.bar = widget.bar
    panel.settings = widget.settings
    panel.anchorItem = widget.panelAnchorItem
    panel.hostWidget = widget
  }

  function unregisterWidget(widget) {
    widgets = widgets.filter(function(item) { return item && item !== widget })
    if (!panel) return
    if (widgets.length === 0) {
      // A singleton must never keep an input surface alive after plugin unload.
      var oldPanel = panel
      panel = null
      panelFactory = null
      oldPanel.close()
      oldPanel.hostWidget = null
      oldPanel.anchorItem = null
      oldPanel.bar = null
      oldPanel.destroy()
    } else if (panel.hostWidget === widget) {
      attach(widgets[0])
    }
  }
}
