import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Ambient.js" as Ambient

// The bar icon and its panel: the live background and screensaver, the
// scenes, what happens on battery, and getting Ambient when it is not there.
// Everything goes through bin/ambient-engine with one fixed verb.
Panel {
  id: root
  moduleName: "io.github.avillagran.ambient"
  ipcTarget: "io.github.avillagran.ambient"

  readonly property string engine: decodeURIComponent(String(Qt.resolvedUrl("bin/ambient-engine")).replace(/^file:\/\//, ""))

  property var ambient: Ambient.emptyState()
  readonly property var rows: Ambient.rows(ambient)
  property int cursor: 0
  property bool cursorActive: false
  property string notice: ""
  property bool refreshAgain: false

  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property color dim: Qt.darker(foreground, 1.55)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  readonly property var focusable: {
    var out = []
    for (var i = 0; i < rows.length; i++) if (rows[i].activate) out.push(i)
    return out
  }

  function refresh() {
    if (stateProc.running) {
      refreshAgain = true
      return
    }
    stateProc.running = true
  }

  function run(args) {
    Quickshell.execDetached(["bash", root.engine].concat(args))
  }

  // get and remove ask in a visible terminal before they change anything.
  function inTerminal(verb) {
    Quickshell.execDetached([
      "xdg-terminal-exec", "--app-id=org.omarchy.terminal", "--title=Ambient",
      "-e", "bash", root.engine, verb
    ])
  }

  function activateRow(row) {
    if (!row || !row.activate) return
    if (row.activate === "choose") {
      if (["background", "screensaver", "random"].indexOf(row.payload) === -1) return
      root.close()
      run(["choose", row.payload])
    } else if (row.activate === "start") {
      if (!Ambient.validScene(row.payload)) return
      notice = "Starting " + Ambient.sceneName(ambient, row.payload) + "."
      run(["start", row.payload])
      settleTimer.restart()
    } else if (row.activate === "stop") {
      notice = "Stopping the live background."
      run(["stop"])
      settleTimer.restart()
    } else if (row.activate === "battery") {
      if (["full", "20fps", "off"].indexOf(row.payload) === -1) return
      run(["battery", row.payload])
      settleTimer.restart()
    } else if (row.activate === "get" || row.activate === "remove") {
      notice = "A terminal opened. This panel updates when it is done."
      inTerminal(row.activate)
    } else if (row.activate === "link") {
      if (!Ambient.safeUrl(row.payload)) return
      Qt.openUrlExternally(row.payload)
      root.close()
    }
  }

  function moveCursor(dy) {
    if (focusable.length === 0) return
    cursorActive = true
    cursor = Math.max(0, Math.min(focusable.length - 1, cursor + dy))
    scrollCursorIntoView()
  }

  function scrollCursorIntoView() {
    if (!panelFlick || !rowColumn) return
    var index = focusable[cursor]
    var item = rowRepeater.itemAt(index)
    if (!item) return
    Qt.callLater(function() {
      var margin = Style.space(6)
      var point = item.mapToItem(panelFlick.contentItem, 0, 0)
      var maxY = Math.max(0, panelFlick.contentHeight - panelFlick.height)
      if (point.y < panelFlick.contentY + margin) panelFlick.contentY = Math.max(0, point.y - margin)
      else if (point.y + item.height > panelFlick.contentY + panelFlick.height - margin)
        panelFlick.contentY = Math.min(maxY, point.y + item.height + margin - panelFlick.height)
    })
  }

  property Item panelFlick: null
  property Item rowColumn: null

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onOpenedChanged: {
    if (opened) {
      cursorActive = false
      cursor = 0
      notice = ""
      if (panelFlick) panelFlick.contentY = 0
      refresh()
    }
  }

  onRowsChanged: if (cursor >= focusable.length) cursor = Math.max(0, focusable.length - 1)

  Component.onCompleted: refresh()

  // bin/ambient-engine bounds what it prints; this is checked again on parsing.
  Process {
    id: stateProc
    command: ["timeout", "-k", "2", "15", "bash", root.engine, "state"]
    stdout: StdioCollector { id: stateOutput }
    onExited: function(exitCode) {
      if (exitCode === 0) root.ambient = Ambient.parseState(stateOutput.text)
      if (root.refreshAgain) {
        root.refreshAgain = false
        Qt.callLater(root.refresh)
      }
    }
  }

  // A scene takes a moment to start or stop.
  Timer {
    id: settleTimer
    interval: 1500
    onTriggered: root.refresh()
  }

  // While the panel is open a terminal may be adding or removing Ambient, or
  // the carousel may change the scene: look again every few seconds.
  Timer {
    interval: 4000
    repeat: true
    running: root.opened
    onTriggered: root.refresh()
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: Ambient.GLYPHS.ambient
    opacity: Ambient.running(root.ambient) ? 1.0 : 0.6
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.RightButton) {
        if (Ambient.installed(root.ambient)) root.run(["choose", "background"])
        else root.toggle()
      } else {
        root.toggle()
      }
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(400))
    contentHeight: panel.fittedContentHeight(column.implicitHeight, Style.space(600))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onMoveRequested: function(dx, dy) {
        if (!root.cursorActive) { root.cursorActive = true; return }
        root.moveCursor(dy)
      }
      onActivateRequested: {
        if (!root.cursorActive) { root.cursorActive = true; return }
        root.activateRow(root.rows[root.focusable[root.cursor]])
      }
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      Flickable {
        id: flick
        anchors.fill: parent
        contentWidth: width
        contentHeight: column.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        flickableDirection: Flickable.VerticalFlick
        interactive: contentHeight > height
        ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }
        Component.onCompleted: root.panelFlick = flick

        Column {
          id: column
          width: flick.width
          spacing: Style.space(10)
          Component.onCompleted: root.rowColumn = column

          PanelHero {
            width: parent.width
            title: "Ambient"
            meta: Ambient.heroMeta(root.ambient)
            foreground: root.foreground
            fontFamily: root.fontFamily
            iconComponent: Component {
              Text {
                textFormat: Text.PlainText
                text: Ambient.GLYPHS.ambient
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.display
              }
            }
          }

          Text {
            textFormat: Text.PlainText
            visible: root.notice !== ""
            width: parent.width
            text: root.notice
            color: root.dim
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
          }

          Repeater {
            id: rowRepeater
            model: root.rows

            Loader {
              required property var modelData
              required property int index
              width: column.width
              sourceComponent: modelData.type === "row" ? rowComponent
                : modelData.type === "header" ? headerComponent
                : modelData.type === "separator" ? separatorComponent
                : modelData.type === "title" ? titleComponent
                : modelData.type === "step" ? stepComponent
                : textComponent
              onLoaded: {
                item.row = modelData
                item.rowIndex = index
              }
            }
          }
        }
      }
    }
  }

  Component {
    id: headerComponent
    PanelSectionHeader {
      property var row: null
      property int rowIndex: 0
      text: row ? row.text : ""
      foreground: root.foreground
      fontFamily: root.fontFamily
    }
  }

  Component {
    id: separatorComponent
    PanelSeparator {
      property var row: null
      property int rowIndex: 0
      foreground: root.foreground
    }
  }

  Component {
    id: titleComponent
    Text {
      property var row: null
      property int rowIndex: 0
      textFormat: Text.PlainText
      text: row ? row.text : ""
      color: root.foreground
      font.family: root.fontFamily
      font.pixelSize: Style.font.heading
      font.bold: true
      wrapMode: Text.WordWrap
    }
  }

  Component {
    id: textComponent
    Text {
      property var row: null
      property int rowIndex: 0
      textFormat: Text.PlainText
      text: row ? row.text : ""
      color: root.dim
      font.family: root.fontFamily
      font.pixelSize: Style.font.bodySmall
      wrapMode: Text.WordWrap
      lineHeight: 1.15
    }
  }

  Component {
    id: stepComponent
    Row {
      property var row: null
      property int rowIndex: 0
      spacing: Style.space(8)

      Text {
        id: stepNumber
        textFormat: Text.PlainText
        text: row ? String(row.number) + "." : ""
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
        width: Style.space(16)
      }

      Text {
        textFormat: Text.PlainText
        text: row ? row.text : ""
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
        wrapMode: Text.WordWrap
        width: parent.width - stepNumber.width - parent.spacing
        lineHeight: 1.15
      }
    }
  }

  Component {
    id: rowComponent
    CursorSurface {
      id: rowSurface
      property var row: null
      property int rowIndex: 0
      readonly property int focusIndex: root.focusable.indexOf(rowIndex)

      hasCursor: root.cursorActive && focusIndex !== -1 && root.cursor === focusIndex
      foreground: root.foreground
      implicitHeight: rowContent.implicitHeight + Style.spacing.rowPaddingX

      MouseArea {
        anchors.fill: parent
        hoverEnabled: true
        enabled: !!(rowSurface.row && rowSurface.row.activate)
        cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
        onEntered: {
          root.cursorActive = true
          if (rowSurface.focusIndex !== -1) root.cursor = rowSurface.focusIndex
        }
        onClicked: root.activateRow(rowSurface.row)
      }

      RowLayout {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        anchors.leftMargin: Style.space(10)
        anchors.rightMargin: Style.space(10)
        spacing: Style.space(8)

        Text {
          textFormat: Text.PlainText
          text: rowSurface.row ? rowSurface.row.glyph : ""
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.icon
          horizontalAlignment: Text.AlignHCenter
          Layout.preferredWidth: Style.font.icon * 1.5
          Layout.alignment: Qt.AlignVCenter
        }

        ColumnLayout {
          id: rowContent
          Layout.fillWidth: true
          spacing: Style.space(1)

          Text {
            textFormat: Text.PlainText
            Layout.fillWidth: true
            text: rowSurface.row ? rowSurface.row.title : ""
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
          }

          Text {
            textFormat: Text.PlainText
            Layout.fillWidth: true
            visible: text !== ""
            text: rowSurface.row ? rowSurface.row.subtitle : ""
            color: root.dim
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            wrapMode: Text.WordWrap
          }
        }

        Text {
          textFormat: Text.PlainText
          visible: text !== ""
          text: rowSurface.row ? rowSurface.row.trailing : ""
          color: rowSurface.row && rowSurface.row.activate ? root.foreground : root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.bodySmall
          Layout.alignment: Qt.AlignVCenter
        }
      }
    }
  }
}
