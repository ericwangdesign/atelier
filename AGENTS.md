# For agents working with Atelier

Atelier is a design stage. Designs are scene files; the designer reviews them on screen and leaves notes.
When the designer presses Send to Claude or Explore, `agent.py` writes your prompt for you. This file is for the
other times: when the designer asks you, in your own session, to "check the notes" or to change a design.

## Where things are

Projects sit next to the `atelier/` folder (or in `atelier/examples/`). Each has `scenes/`:

- `index.js` lists the designs in order: `scenes(['home-v1', 'home-v2'])`.
- `<id>.js` one design. It pushes one object onto `SCENES`: `id`, `title`, `version`, `note`, `steps`, `html`, `css`,
  and optional `controls`. Versions of one design share a `title`.
- `notes/brief.md` the open notes as a brief. `notes/notes.json` every note.
- `trail.json` why each version exists.

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
   several cut elements, or an area with what's inside it). A note left on selected words also quotes them
   (`On the words: "..."`, and `quote` in notes.json): change that text. Snapshots are in `notes/snaps/`.
3. Prefer a new version over editing in place: copy `home-v2.js` to the next free `home-vN.js`, change its `id` and
   `version`, list it in `index.js` right after its family, and make the changes there. Then the designer can compare.
4. In `notes/notes.json`, for each note you handled: set `"done": true` and add
   `"replies": [{"who": "Claude", "text": "what you changed, in one line", "made": "home-v3"}]`. Keep the file valid
   JSON and leave other notes alone. The page picks it up within two seconds.
5. Tell the designer what changed, by note number.

Controls listed under "Controls moved off their defaults" are values the designer picked. Bake them in as the
scene's new defaults (the control's `value` and the CSS fallback) when asked.

## Taste

Match the design's existing spacing, type, colour and motion. Keep every step playing. Change what the note asks
for and nothing else.
