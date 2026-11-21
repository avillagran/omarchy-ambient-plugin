// Loads Ambient.js (a QML JavaScript library) in Node and checks its logic.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const source = fs.readFileSync(path.join(__dirname, "..", "Ambient.js"), "utf8").replace(/^\.pragma library\n/, "")
const sandbox = { module: { exports: {} } }
vm.runInNewContext(source, sandbox)
const A = sandbox.module.exports

const tests = []
const test = (name, fn) => tests.push([name, fn])
const state = (lines) => A.parseState(lines.join("\n"))
const titles = (s) => A.rows(s).filter((r) => r.type === "row").map((r) => r.title)

const userState = state([
  "where\tuser", "pin\t0.6.3", "version\t0.6.1", "background\tsand-clock", "screensaver\ttext",
  "battery\t20fps", "charger\t1",
  "S\tsand-clock\tSand Clock\tThe time in sand\tx",
  "S\tneon-city\tNeon City\tTowers\ty",
])

test("an empty or oversized answer is not trusted", () => {
  assert.equal(A.parseState("").where, "none")
  assert.equal(A.parseState("where\tuser\n" + "x".repeat(80000)).known, false)
  assert.equal(A.parseState(undefined).known, false)
})

test("only known values are taken", () => {
  const s = state(["where\troot", "pin\tlatest", "version\t1.0;rm", "background\t../x", "battery\tturbo"])
  assert.equal(s.where, "none")
  assert.equal(s.pin, "")
  assert.equal(s.version, "")
  assert.equal(s.background, "")
  assert.equal(s.battery, "")
})

test("old battery words are read as the new modes", () => {
  assert.equal(state(["battery\trun"]).battery, "full")
  assert.equal(state(["battery\tpause"]).battery, "off")
})

test("scenes are validated, de-duplicated, cleaned and capped", () => {
  const lines = ["S\tok\tOk\td\tg", "S\tok\tAgain\td\tg", "S\t../x\tBad\td\tg", "S\tctl\tA\u0007B\u001b[31m\td\tg"]
  for (let i = 0; i < 200; i++) lines.push(`S\ts-${i}\tS\td\tg`)
  const s = state(lines)
  assert.equal(s.scenes[0].name, "Ok")
  assert.equal(s.scenes.filter((x) => x.id === "ok").length, 1)
  assert.ok(!s.scenes.some((x) => x.id === "../x"))
  assert.equal(s.scenes.find((x) => x.id === "ctl").name, "AB[31m")
  assert.equal(s.scenes.length, 96)
})

test("without Ambient the panel offers to get it and a link, nothing else", () => {
  const s = state(["where\tnone", "pin\t0.6.3"])
  assert.equal(JSON.stringify(A.rows(s).filter((r) => r.activate).map((r) => r.activate)), '["get","link"]')
  assert.equal(A.heroMeta(s), "Not installed yet")
  for (const r of A.rows(s)) if (r.activate === "link") assert.ok(A.safeUrl(r.payload))
})

test("a user copy gets the actions, battery modes, scenes, update and remove", () => {
  const t = titles(userState)
  for (const want of ["Choose a background", "Choose the screensaver", "Surprise me", "Stop the live background",
    "Full speed", "20 FPS", "Turn off", "Sand Clock", "Neon City", "Update Ambient to 0.6.3", "Remove Ambient"]) {
    assert.ok(t.includes(want), want)
  }
  assert.equal(A.heroMeta(userState), "Background: Sand Clock")
  const current = A.rows(userState).find((r) => r.title === "20 FPS")
  assert.equal(current.activate, "")
  const playing = A.rows(userState).find((r) => r.title === "Sand Clock")
  assert.equal(playing.activate, "")
  assert.equal(A.rows(userState).find((r) => r.title === "Neon City").activate, "start")
})

test("no update offer for the same or a newer version, and none for a system copy", () => {
  assert.ok(!A.canUpdate(state(["where\tuser", "pin\t0.6.3", "version\t0.6.3"])))
  assert.ok(!A.canUpdate(state(["where\tuser", "pin\t0.6.3", "version\t0.6.10"])))
  assert.ok(A.canUpdate(state(["where\tuser", "pin\t0.6.10", "version\t0.6.9"])))
  const sys = state(["where\tsystem", "pin\t0.6.3", "version\t0.6.1"])
  assert.ok(!A.canUpdate(sys))
  assert.ok(!A.canRemove(sys))
  assert.ok(!titles(sys).includes("Remove Ambient"))
})

test("battery rows only with a charger, stop only while a scene runs", () => {
  const s = state(["where\tsystem", "background\tnone", "charger\t0"])
  assert.ok(!titles(s).includes("Full speed"))
  assert.ok(!titles(s).includes("Stop the live background"))
  assert.equal(A.heroMeta(s), "Background: your wallpaper")
})

test("only the two project pages open in the browser", () => {
  assert.ok(A.safeUrl("https://github.com/avillagran/omarchy-ambient"))
  assert.ok(!A.safeUrl("https://github.com/avillagran/omarchy-ambient/../x"))
  assert.ok(!A.safeUrl("file:///etc/passwd"))
  assert.ok(!A.validScene("-h"))
})

let failed = 0
for (const [name, fn] of tests) {
  try { fn(); console.log(`  ok   ${name}`) } catch (e) { failed++; console.log(`  FAIL ${name}\n${e.stack}`) }
}
process.exit(failed ? 1 : 0)
