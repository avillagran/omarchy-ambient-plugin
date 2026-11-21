.pragma library

// The pure logic of the panel: reading what bin/ambient-engine reports and
// deciding which rows to show. No I/O happens here, so the tests can load this
// file in Node.

var GLYPHS = {
  ambient: String.fromCodePoint(0xf1104),   // the screensaver glyph Ambient uses for its own menu
  background: String.fromCodePoint(0xf0e09),
  screensaver: String.fromCodePoint(0xf0379),
  random: String.fromCodePoint(0xf049d),
  stop: String.fromCodePoint(0xf04db),
  battery: String.fromCodePoint(0xf0079),
  get: String.fromCodePoint(0xf01da),
  update: String.fromCodePoint(0xf06b0),
  remove: String.fromCodePoint(0xf0a7a),
  link: String.fromCodePoint(0xf0337),
  check: String.fromCodePoint(0xf012c),
  play: String.fromCodePoint(0xf040a)
}

var REPO_URL = "https://github.com/avillagran/omarchy-ambient"
var PLUGIN_URL = "https://github.com/avillagran/omarchy-ambient-plugin"

var BATTERY_MODES = [
  { mode: "full", label: "Full speed", subtitle: "Scenes run as on the charger" },
  { mode: "20fps", label: "20 FPS", subtitle: "Scenes slow down to save power" },
  { mode: "off", label: "Turn off", subtitle: "Your wallpaper comes back until you plug in" }
]

var MAX_SCENES = 96
var MAX_TEXT = 70000

function emptyState() {
  return { known: false, where: "none", pin: "", version: "", background: "", screensaver: "",
    battery: "", charger: false, scenes: [] }
}

function validScene(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,47}$/.test(id)
}

function validVersion(v) {
  return typeof v === "string" && /^[0-9]+(\.[0-9]+){0,3}$/.test(v)
}

function clean(text, max) {
  return String(text || "").replace(/[\u0000-\u001f\u007f-\u009f]/g, "").slice(0, max)
}

function parseState(text) {
  var state = emptyState()
  if (typeof text !== "string" || text.length > MAX_TEXT) return state
  var lines = text.split("\n")
  var seen = ({})
  for (var i = 0; i < lines.length; i++) {
    var f = lines[i].split("\t")
    if (f[0] === "S") {
      if (state.scenes.length >= MAX_SCENES || f.length < 3 || !validScene(f[1]) || seen[f[1]]) continue
      seen[f[1]] = true
      state.scenes.push({ id: f[1], name: clean(f[2], 64) || f[1], description: clean(f[3], 200), glyph: clean(f[4], 4) })
    } else if (f.length === 2) {
      var key = f[0]
      var value = f[1]
      if (key === "where" && /^(system|user|other|none)$/.test(value)) state.where = value
      else if ((key === "pin" || key === "version") && validVersion(value)) state[key] = value
      else if ((key === "background" || key === "screensaver") && validScene(value)) state[key] = value
      else if (key === "battery" && /^(full|20fps|off|run|pause)$/.test(value)) state.battery = value
      else if (key === "charger") state.charger = value === "1"
    }
  }
  // Older Ambient settings: run is full speed and pause is off.
  if (state.battery === "run") state.battery = "full"
  if (state.battery === "pause") state.battery = "off"
  state.known = true
  return state
}

function compareVersions(a, b) {
  var x = String(a).split(".")
  var y = String(b).split(".")
  for (var i = 0; i < Math.max(x.length, y.length); i++) {
    var d = (parseInt(x[i] || "0", 10) || 0) - (parseInt(y[i] || "0", 10) || 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return 0
}

function installed(state) {
  return state.where !== "none"
}

// Only a copy this plugin can manage, and only when the pinned release is newer.
function canUpdate(state) {
  return state.where === "user" && validVersion(state.pin)
    && (!state.version || compareVersions(state.pin, state.version) > 0)
}

function canRemove(state) {
  return state.where === "user"
}

function sceneName(state, id) {
  if (!id || id === "none") return ""
  if (id === "text") return "Omarchy's own screensaver"
  for (var i = 0; i < state.scenes.length; i++) if (state.scenes[i].id === id) return state.scenes[i].name
  return id
}

function running(state) {
  return !!state.background && state.background !== "none"
}

function heroMeta(state) {
  if (!state.known) return "Looking"
  if (!installed(state)) return "Not installed yet"
  if (running(state)) return "Background: " + sceneName(state, state.background)
  return "Background: your wallpaper"
}

function safeUrl(url) {
  return url === REPO_URL || url === PLUGIN_URL
}

// Every line of the panel. Rows with an `activate` take the cursor.
function rows(state) {
  var out = []
  if (!state.known) return out
  if (!installed(state)) {
    out.push({ type: "text", text: "Live backgrounds and screensavers drawn from text on the GPU: more than thirty scenes that follow the cursor and react to what is playing." })
    out.push({ type: "header", text: "GET AMBIENT" })
    out.push({ type: "step", number: 1, text: "Get Ambient opens a terminal that downloads Ambient " + state.pin + " from GitHub and checks it against the checksums in this plugin." })
    out.push({ type: "step", number: 2, text: "It asks before changing anything, then adds Ambient for your user under ~/.local. No password is needed." })
    out.push({ type: "step", number: 3, text: "Pick a scene here, or press Super+Ctrl+Space for the carousel with live previews." })
    out.push({ type: "row", glyph: GLYPHS.get, title: "Get Ambient " + state.pin, subtitle: "x86_64 and ARM64 · about 6 MB", trailing: "", activate: "get", payload: "" })
    out.push({ type: "row", glyph: GLYPHS.link, title: "See every scene on GitHub", subtitle: "", trailing: "", activate: "link", payload: REPO_URL })
    return out
  }

  out.push({ type: "row", glyph: GLYPHS.background, title: "Choose a background", subtitle: "The carousel with live previews", trailing: "", activate: "choose", payload: "background" })
  out.push({ type: "row", glyph: GLYPHS.screensaver, title: "Choose the screensaver",
    subtitle: state.screensaver ? "Now: " + sceneName(state, state.screensaver) : "", trailing: "", activate: "choose", payload: "screensaver" })
  out.push({ type: "row", glyph: GLYPHS.random, title: "Surprise me", subtitle: "A random scene", trailing: "", activate: "choose", payload: "random" })
  if (running(state)) {
    out.push({ type: "row", glyph: GLYPHS.stop, title: "Stop the live background", subtitle: "Back to your wallpaper", trailing: "", activate: "stop", payload: "" })
  }

  if (state.charger) {
    out.push({ type: "header", text: "ON BATTERY" })
    for (var b = 0; b < BATTERY_MODES.length; b++) {
      var m = BATTERY_MODES[b]
      var current = state.battery === m.mode
      out.push({ type: "row", glyph: GLYPHS.battery, title: m.label, subtitle: m.subtitle,
        trailing: current ? GLYPHS.check : "", activate: current ? "" : "battery", payload: m.mode })
    }
  }

  if (state.scenes.length > 0) {
    out.push({ type: "header", text: "SCENES" })
    for (var i = 0; i < state.scenes.length; i++) {
      var s = state.scenes[i]
      var active = s.id === state.background
      out.push({ type: "row", glyph: s.glyph || GLYPHS.ambient, title: s.name, subtitle: s.description,
        trailing: active ? GLYPHS.check : "", activate: active ? "" : "start", payload: s.id })
    }
  }

  if (canUpdate(state) || canRemove(state)) out.push({ type: "separator" })
  if (canUpdate(state)) {
    out.push({ type: "row", glyph: GLYPHS.update, title: "Update Ambient to " + state.pin,
      subtitle: state.version ? "You have " + state.version : "", trailing: "", activate: "get", payload: "" })
  }
  if (canRemove(state)) {
    out.push({ type: "row", glyph: GLYPHS.remove, title: "Remove Ambient", subtitle: "Puts back what it replaced", trailing: "", activate: "remove", payload: "" })
  }
  return out
}

if (typeof module !== "undefined") {
  module.exports = {
    GLYPHS: GLYPHS, BATTERY_MODES: BATTERY_MODES, REPO_URL: REPO_URL, PLUGIN_URL: PLUGIN_URL,
    emptyState: emptyState, parseState: parseState, validScene: validScene, validVersion: validVersion,
    compareVersions: compareVersions, installed: installed, canUpdate: canUpdate, canRemove: canRemove,
    sceneName: sceneName, running: running, heroMeta: heroMeta, safeUrl: safeUrl, rows: rows
  }
}
