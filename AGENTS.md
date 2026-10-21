# For agents working with Atelier

Atelier is a design stage. Designs are scene files; the designer reviews them on screen and leaves notes.
When the designer presses Send to agent, `agent.py` writes your prompt for you. This file is for the
other times: when the designer asks you, in your own session, to "check the notes" or to change a design.

## Where things are

Projects sit next to the `atelier/` folder (or in `atelier/examples/`). Each has `scenes/`:

**Client > project > design > version.** Four levels, each one thing: a **client** is a folder next to `atelier/` and a row on home; a **project**
is a `scenes/` folder in it and a card (`client/app/scenes/`, `client/modals/scenes/`; a folder's own `scenes/` is
its one project, named after it); a **design** is one screen or flow, its versions sharing a title; a **version** is one
take. Every count names only the level right below it: a row counts projects, a card counts designs, a design counts
versions. Home never shows versions. New work for a client
that already has a folder goes inside it: a new project folder, or a design in a project. Never start a new folder next
to `atelier/` for it, and never put a link there that points into another folder: either one makes a second row.

- `index.js` lists the designs in order: `scenes(['home-v1', 'home-v2'])`.
- `<id>.js` one design. It pushes one object onto `SCENES`: `id`, `title`, `version`, `note`, `steps`, `html`, `css`,
  and optional `controls`. Versions of one design share a `title`. A control is
  `{ key, label, type: range|seg|select|color|toggle, value, css: '--var' | attr }`; `{ type: 'group', label, key? }`
  starts a named group (with a `key`, a switch in its head that works like a toggle).
- `notes/brief.md` the open notes as a brief. `notes/notes.json` every note.
- `trail.json` why each version exists.

**Every design is a prototype you can use, not a replay (Eric, Oct 18).** Give a design a `live(root)` function: Atelier
runs it once with the scene's root (inside its shadow root) and the clock never drives it, so taps, swipes, typing,
scrolling and screen changes are the design's own code. Real buttons, inputs and textareas; state in the function.
Give it a tour too, so the bar plays it like a motion design (Eric: a prototype still needs the video bar): named `steps`,
and `live()` returns `at(i)`, which puts the design in step i's state from scratch (so scrubbing back works) and then
plays that step's move. A tap on the design while it plays pauses it, and from there it's used by hand. A prototype
with one step gets a Restart bar instead. Timed attributes (below) are for motion studies only, when asked for one.
Example: `Side Projects/today-everywhere/scenes/phone-today-v9.js` (the tour at the end of `live`).

**A design that frames a live page** (`html: '<iframe src="/p/<project>/page/">'`, like the Sunday canvas) follows
the bar from inside the frame. Its scene root is `frameElement.closest('.scene')`, and Atelier keeps three things on it:
`data-step` (the step, from 0), `--p` (how far through it, 0 to 1) and `data-paused` (there while the bar is paused:
the pause button, a step or the scrubber picked, a note being written, the end). Read them every frame. While
`data-paused` is there, hold: no new beat, and the page's own timers and typing stop where they are (count waiting time
only while it's absent). When it goes, carry on from there, not from the start. A step that changes while paused jumps
to that step's end state; it never plays the beat. Atelier pauses the page's CSS and Web Animations itself; only
JavaScript timing is the page's job. `tests/fixture/page/index.html` is the smallest page that does it.

The scene format, and every attribute a scene animates with (`data-in`, `data-out`, `data-type`, `data-state`,
`data-focus`), is explained at the top of `atelier/starter/first.js`. Wrap a scene in a block (`{ ... }`) so its
helpers stay its own: the stage runs a file again when it changes.

On phone and tablet sizes a design runs the full height of the screen, under the status bar and home indicator, as on
a real device. Keep content clear of them with `var(--safe-top)` and `var(--safe-bottom)` (0 on desktop sizes); let
backgrounds run to the edges.

## Check the notes

1. Read the brief: `<project>/scenes/notes/brief.md`. If several projects have open notes, take the one the designer
   names, else the most recently changed. Its second line names the project and where its files are.
2. Each note names the scene file, the step, where on the screen it was pinned, and what was under it (an element,
   several cut elements, or an area with what's inside it). Snapshots are in `notes/snaps/`. A note made on selected
   words quotes them (`On the words: "..."`; `words` in notes.json): the note is about that exact text.
3. Prefer a new version over editing in place: copy `home-v2.js` to the next free `home-vN.js`, change its `id` and
   `version`, list it in `index.js` right after its family, and make the changes there. Then the designer can compare.
4. In `notes/notes.json`, for each note you handled: set `"done": true` and add
   `"replies": [{"who": "<your name>", "text": "what you changed, in one line", "made": "home-v3"}]`. Keep the file valid
   JSON and leave other notes alone. The page picks it up within two seconds.
5. Tell the designer what changed, by note number.

A note with `/try 3` in it (or `/try 2`, `/try 4`) asks for that many takes on just that part, with everything else
held still. In your own session, make each take its own version, change only what the note is about in each, and
leave the note open: the designer picks one.

Controls listed under "Controls moved off their defaults" are values the designer picked. Bake them in as the
scene's new defaults (the control's `value` and the CSS fallback) when asked.

## Taste

Match the design's existing spacing, type, colour and motion. Keep every step playing. Change what the note asks
for and nothing else.
