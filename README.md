# Ambient for Omarchy

Live backgrounds and screensavers for [Omarchy](https://omarchy.org): sand clocks,
neon cities, a black hole, an aquarium and more than thirty other scenes, drawn
from text glyphs on the GPU behind your windows. Every scene follows the cursor
and reacts to what is playing, and each one also works as the screensaver.

This plugin puts Ambient in the bar. From its panel you pick a background or a
screensaver, start any scene, choose what happens on battery, and, when Ambient
is not on the computer yet, get it in one step.

![Ambient](preview.jpg)

## The scenes

| | | |
|---|---|---|
| ![Sunset Drive](media/sunset-drive.jpg) | ![Lunar Drift](media/lunar-drift.jpg) | ![Neon City](media/neon-city.jpg) |
| Sunset Drive | Lunar Drift | Neon City |
| ![Neon Transit](media/neon-transit.jpg) | ![Eye](media/eye.jpg) | ![Cockpit](media/cockpit.jpg) |
| Neon Transit | Eye | Cockpit |
| ![Aquarium](media/aquarium.jpg) | ![Jellyfish](media/jellyfish.jpg) | ![Data Globe](media/data-globe.jpg) |
| Aquarium | Jellyfish | Data Globe |
| ![Event Horizon](media/event-horizon.jpg) | ![Supernova](media/supernova.jpg) | ![Abyss](media/abyss.jpg) |
| Event Horizon | Supernova | Abyss |
| ![Solar System](media/solar-system.jpg) | ![Load Canyon](media/load-canyon.jpg) | ![Neon Avenue](media/neon-avenue.jpg) |
| Solar System | Load Canyon | Neon Avenue |
| ![Packet Grid](media/packet-grid.jpg) | ![Silicon](media/silicon.jpg) | ![Sand Clock Galaxy](media/sand-clock-galaxy.jpg) |
| Packet Grid | Silicon | Sand Clock Galaxy |
| ![Sand Clock Chladni](media/sand-clock-chladni.jpg) | ![Sand Clock Dunes](media/sand-clock-dunes.jpg) | ![Sand Clock Ferrofluid](media/sand-clock-ferrofluid.jpg) |
| Sand Clock Chladni | Sand Clock Dunes | Sand Clock Ferrofluid |
| ![Sand Clock Excavation](media/sand-clock-excavation.jpg) | ![Sand Clock Zen](media/sand-clock-zen.jpg) | ![Sand Clock Foundry](media/sand-clock-foundry.jpg) |
| Sand Clock Excavation | Sand Clock Zen | Sand Clock Foundry |
| ![Sand Clock Swarm](media/sand-clock-swarm.jpg) | ![Sand Clock Shore](media/sand-clock-shore.jpg) | ![Sand Clock Glass](media/sand-clock-glass.jpg) |
| Sand Clock Swarm | Sand Clock Shore | Sand Clock Glass |
| ![Sand Clock Dust Devil](media/sand-clock-dust-devil.jpg) | ![Sand Clock Spectrum](media/sand-clock-spectrum.jpg) | ![Sand Clock Mandala](media/sand-clock-mandala.jpg) |
| Sand Clock Dust Devil | Sand Clock Spectrum | Sand Clock Mandala |

The panel, with a scene running:

![The Ambient panel](media/panel.png)

## Install the plugin

```sh
omarchy plugin add https://github.com/avillagran/omarchy-ambient-plugin --enable
```

Or add it from the plugin marketplace. The icon goes to the right of the bar;
move it like any other widget. It needs Omarchy 4.0 or newer, on x86_64 or ARM64.

## Getting Ambient itself

The scenes come from [omarchy-ambient](https://github.com/avillagran/omarchy-ambient),
a separate project with a GPU renderer, so the plugin works with whichever copy
of Ambient the computer has:

- **Ambient comes with your system** (a future Omarchy may ship it): the panel
  uses it and never changes it.
- **Ambient is not there**: the panel offers **Get Ambient**. It opens a
  terminal that says what it will do and asks before doing anything. If you
  agree, it:
  1. downloads Ambient's user script from one fixed commit
     (`b10d3ebe1ce5d953b08eb1ead59184384245e9d6`) and the bundle for your
     machine from release `v0.6.3`, both over HTTPS, with size and time limits;
  2. checks both files against the SHA-256 digests written in
     [`bin/ambient-engine`](bin/ambient-engine), and stops without changing
     anything if either one differs;
  3. runs that script, which adds Ambient for your user under `~/.local`.

  No sudo or pkexec is required, nothing runs as root, and nothing is
  downloaded except those two files. The download goes to a private folder in
  your runtime directory, which is removed afterwards.
- **An older copy of Ambient that this plugin added**: the panel offers
  **Update Ambient** to the release this plugin version names, the same way.

A new Ambient release reaches the panel with a new version of this plugin, which
updates the commit and the digests.

### What Ambient's script adds

All of it is in your home folder and listed in the script's own record, so it
can be taken away again:

- `~/.local/bin/omarchy-ambient`, `omarchy-ambient-select` and the renderer;
- the scenes and the carousel in `~/.local/share/omarchy-ambient` and
  `~/.local/lib/omarchy-ambient`, and caches in `~/.cache`;
- Ambient's carousel plugin, `avillagran.ambient-selector`, in
  `~/.config/omarchy/plugins`, and its settings in `~/.config/omarchy/ambient`;
- Super+Ctrl+Space for the carousel (`~/.config/hypr/ambient-background-selector.lua`,
  loaded from a marked block in `hyprland.lua`);
- rows in Style > Background in Omarchy's menu, inside a marked block of
  `~/.config/omarchy/extensions/omarchy-menu.jsonc`, and the screensaver for
  Omarchy's idle timeout, as the plugin `omarchy-ambient.idle` in
  `~/.config/omarchy/plugins`.

Anything it replaces is copied to `~/.local/share/omarchy-ambient-backup` first.
Updates and removal only replace or delete files that are still as the script
left them: a scene or shortcut you edit afterwards stays, and anything it
cannot check is moved to `~/.local/share/omarchy-ambient-saved` instead of
deleted. A file you keep as a symlink is never written through.

## Remove

If this plugin added Ambient, open the panel and choose **Remove Ambient**
first. Like Get Ambient, it opens a terminal, asks, downloads the same pinned
script, checks it, and runs it with `--uninstall`, which removes everything
listed above and puts back what it replaced. Settings you edited in
`~/.config/omarchy/ambient`, and scenes you edited, stay. Then remove the plugin:

```sh
omarchy plugin remove io.github.avillagran.ambient
```

The plugin itself keeps no files outside its folder.

## What the plugin does on your system

- Runs [`bin/ambient-engine`](bin/ambient-engine) as you, with one fixed verb
  at a time. Scene names are checked against a strict pattern before they reach
  Ambient, and what Ambient reports is cut short and stripped of control
  characters before the panel shows it, always as plain text.
- While its panel is open, asks Ambient every few seconds which scene is
  running, so the panel follows the carousel.
- Opens links only to this plugin's and Ambient's pages on GitHub.
- Makes no network requests except Get, Update and Remove Ambient, each in a
  visible terminal, after you say yes.

### Requirements

Everything the plugin calls ships with Omarchy: `bash`, `curl`, `jq`,
`sha256sum`, `tar`, `timeout` and `xdg-terminal-exec`. Ambient's script also
checks for `socat`, `inotifywait` and `parec` and names any that are missing.
Node.js is needed only to run the tests.

## Development

```sh
tests/run
```

`tests/run` checks `bin/ambient-engine` against a fake Ambient and a fake
`curl`: what it reports, which arguments reach Ambient, that a download that
does not match is never run, and that nothing goes to `/tmp`. It also checks the
panel's logic in `Ambient.js` with Node.

## License

MIT. See [LICENSE](LICENSE). The scene images are from omarchy-ambient, by the
same author, under the same license.
