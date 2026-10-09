import QtQml
import qs.Commons

// Shared interface typography for every Light panel. Scripture keeps its own
// reader scale; titles, controls, labels, and supporting text follow app size.
QtObject {
  property real appScale: 1.2

  readonly property real scaleFactor: Math.max(0.8, Math.min(1.6, appScale))
  readonly property real body: Math.max(
    Style.font.bodySmall,
    Math.round((Style.font.body + Style.space(2)) * scaleFactor)
  )
  readonly property real title: Math.max(
    Style.font.title,
    Math.round(body * 1.25)
  )
  readonly property real section: Math.max(
    Style.font.bodySmall,
    Math.round(body * 0.8)
  )
  readonly property real bodySmall: Math.max(
    Style.font.bodySmall,
    Math.round(body * 0.88)
  )
  readonly property real caption: Math.max(
    Style.font.caption,
    Math.round(body * 0.76)
  )
  readonly property real panelPadding: Style.spacing.panelPadding * scaleFactor
  readonly property real panelGap: Style.spacing.panelGap * scaleFactor
  readonly property real controlGap: Style.spacing.controlGap * scaleFactor
  readonly property real labelGap: Style.spacing.labelGap * scaleFactor
}
