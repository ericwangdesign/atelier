# Atelier

A design stage for designers who build with a coding agent. The agent stays outside it.

You pin notes on a design, copy them as a brief, and your own agent session makes the next version, which shows
beside the original. Every version remembers the notes that made it.

It's for designers who know what they want: there's no prompt box and no agent inside. Notes are the only way to ask.

Designs are code: one small JavaScript file per design, with a timeline, so they move. Atelier plays them,
compares them, and keeps the conversation about them.

## What it needs

- **A Mac.** It's built and tested on macOS. Linux should work; Windows hasn't been tried.
- **Python 3.8 or newer** for the server. Nothing to install for it.
- **A coding agent of your own**, in its own session ([Claude Code](https://claude.com/claude-code), Gemini CLI, Codex, any).
  Atelier never runs it: you hand it the brief.
- **Google Chrome and Node**, only for exporting PNG, GIF and MP4.

## Start

```
git clone https://github.com/ericwangdesign/atelier
cd atelier
npm install          # only for exporting PNG, GIF and MP4
python3 serve.py
```

Open http://localhost:4321. Two example projects are there until you make your own: **Sample**, a coffee order in two
versions, and **Gym Tracker**, an iPhone app for the gym in ten versions that you can tap through like the real thing.
Press Space to play one; shift-click a second version in the Designs list to see them side by side.

**[The manual](docs/manual.md)** shows every part of it, with pictures.

## The loop

1. **Note.** Press N and click a screen to pin a note, or drag to note an area. Press X to cut out an element
   instead; shift-click to gather several into one note.
2. **Copy brief** (Notes tab). Every open note goes on the clipboard: where it is, what's under it, the words or
   values you changed and the controls you moved. Paste it into your agent session, or tell the session to "check the
   notes": `AGENTS.md` says how.
3. **The next version.** The session copies the design as its next version and works there. It shows beside the
   original without a refresh, and each note gets a reply that links to the version it made.
4. **History** (foot of the Notes tab). Why each version exists: its parent and the notes that made it. Compare shows
   the before and after. **Share** writes it as a page for people who aren't designers: the two pictures, flip or
   slide between them, the notes and replies beside them.
5. **Taste** (its own tab). What you like, in short lines you can read: "accent colour only on prices, selection and
   the main action". Add a line, edit one, × forgets it, and one switch turns the whole thing off.

Nothing you made is ever overwritten. Every round of notes is a new version, so every change has a before and an after.

## Taste

One list of what you like, for every design tool you use an agent with. It's `taste.json` in this folder, never
committed, written out as `taste.md` on every change so any agent session can read it before design work. A line is
about every design ("Everywhere") or this project's own brand ("This project"); click to switch.
`atelier taste add "the rule"` adds a line from any terminal. Nothing in Atelier learns or rewrites the list.

## Projects

A project is any folder next to `atelier/` with a `scenes/` folder in it (or set `ATELIER_PROJECTS` to another
folder). The examples in `examples/` are projects too, until you have one of your own: then they step aside. A folder with sub-folders that have their own `scenes/` (`client/app/scenes/`, `client/modals/scenes/`) is a
client: one row on home, one card per project, and each card skims that project's designs.

```
Projects/
  my-app/
    scenes/
      index.js          lists the designs:  scenes(['home-v1', 'home-v2']);
      home-v1.js        one file per design
      home-v2.js
      workspace.json    variants and control values you picked
      trail.json        why each version exists (worth committing)
      notes/            notes and snapshots (never committed)
    exports/            PNG, GIF, MP4 and shared pages
  atelier/              this tool
```

**New project** (top of the panel, or on Home) makes `<name>/scenes/` from `starter/`. To add a design by hand, copy
a scene file, change it, and add its name to `index.js`. `starter/first.js` explains every attribute a scene can
animate with.

`scenes(['a-v1'], ['helpers'])` loads `scenes/helpers.js` before the designs, for code they share. A project's
typefaces go in `scenes/fonts.css`.

## The shelf

Home is a file browser: folders, and in them projects. Everything is set in type: a folder shows the names of what's
in it, a project or a design is a card with its name and facts. A project's page has its context, its docs and its
designs, one card each; a design's iterations are the chips under its card. It's one file, `project.json`, in the project's folder.

- **Folders** go as deep as you like. New folder makes one; drag a project or a folder onto a folder to move it;
  double-click a folder's name at the top to rename it. Nothing moves on disk.
- A design can be any prototype, not only one made in Atelier:
  `atelier publish my-app --title "One-page checkout" --open http://localhost:5173 --run "npm run dev" --source <repo>`.
  Atelier takes a picture of it. A project with `scenes/` lists its designs by itself.
- **Remix** on a design copies a brief for your agent: the context, the docs, how to run the iteration you picked, and
  the `atelier publish … --from <iteration>` line that puts your take back on the same card.
- Share the projects folder (a repo, a drive) and a team shares the shelf. `ATELIER_USER` is your name on what you
  publish; without it, the name git signs your commits with.

## On the stage

- **Compare.** Shift-click designs to put up to five on screen, lettered A to E, in step: step 3 always shows next to
  step 3. With two, View offers Swipe, Onion and Difference. Rows and Columns lay any two axes out as a grid
  (versions down, phone and desktop across).
- **Controls.** A scene can list knobs (`range`, `seg`, `select`, `color`, `toggle`) that set CSS variables or
  attributes, folded into named groups (`{ type: 'group', label }`). A swatch opens a colour picker like Figma's. Copy
  values writes the ones you moved as a request to bake them in. Save variant keeps a set of values as its own
  design.
- **Focus.** F, then click an element: every screen crops to that part. Mark comparable parts with `data-focus`.
- **Duplicate.** The icon at a screen's top right copies its scene file as the next version, side by side. It works
  for designs built from a shared template too.
- **Export.** Prototype › Export makes a PNG of the step you're on, or a GIF or MP4 of the flow, one file per screen.

## Keys

Space plays. ← → step, `,` `.` frame. N note, X cut, F focus. C compare, V view. 0 fits, 1 is 100%.
`\` hides the panel, H everything but the screens, R restarts.

## Files

- `index.html` Home: every project and its designs. `stage.html` the stage. `engine.js` plays a scene.
- `trail.js`, `trail.css` History on the stage: why each version exists, Compare and Share.
- `serve.py` the server: projects, notes, exports. `page.py` writes shared pages.
- `taste.py`, `taste.js` the taste list and the Taste tab.
- `capture.mjs` exports, in a hidden Chrome. `starter/` what a new project starts from. `examples/` sample projects.

Everything stays on your computer: the server only listens on 127.0.0.1.

## License

MIT. See [LICENSE](LICENSE).
