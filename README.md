# Atelier

A design stage where you and a coding agent work on the same screens.

You pin notes on a design and the agent answers them on a copy, beside the original, live. A note you're unsure about
gets `/try 3`: three takes on just that part, side by side, with everything else held still. You pick one and say why.
Every version remembers what made it, and Atelier learns your taste from how each design got where it is.

It's for designers who know what they want: there's no prompt box. Notes are the only way to ask.

Designs are code: one small JavaScript file per design, with a timeline, so they move. Atelier plays them,
compares them, and keeps the conversation about them.

## What it needs

- **A Mac.** It's built and tested on macOS. Linux should work; Windows hasn't been tried.
- **Python 3.8 or newer** for the server. Nothing to install for it.
- **A coding agent with a command line**, signed in: [Claude Code](https://claude.com/claude-code) by default,
  or Gemini CLI, Codex, or your own (see Agents). Atelier runs it for you with the sign-in you already have.
- **Google Chrome and Node**, only for exporting PNG, GIF and MP4.

## Start

```
git clone https://github.com/ericwangdesign/atelier
cd atelier
npm install          # only for exporting PNG, GIF and MP4
python3 serve.py
```

Open http://localhost:4321. The **Sample** project is a coffee order in two versions. Press Space to play it.

**[The manual](docs/manual.md)** shows every part of it, with pictures.

## The loop

1. **Note.** Press N and click a screen to pin a note, or drag to note an area. Press X to cut out an element
   instead; shift-click to gather several into one note.
2. **Send to agent** (Notes tab). The design is copied as its next version, which appears beside the original at
   once. The agent works on the copy only, and the copy rebuilds on screen every time it saves. Each note gets a reply
   and is marked done; the reply links to the version it made.
3. **`/try` a note you're unsure of.** Type `/` in a note and Tab takes `/try 3`. Once the plain notes land, that note
   gets three takes on top of the new version, each by its own agent at the same time, each changing only that part.
4. **Pick.** A critic ranks the takes against your taste first (a blue 1 on its pick); it never picks for you. Pick
   one and add a line on why. The next `/try` note starts from your pick.
5. **History** (foot of the Notes tab). Why each version exists: its parent, the notes that made it, the pick and the
   reason. Compare shows the before and after. **Share** writes it as a page for people who aren't designers: the
   two pictures, flip or slide between them, the notes and replies beside them.
6. **Taste** (its own tab). Atelier learns what you like from each design's whole journey: what you asked for more
   than once, what you pulled back, which take you picked and why. Short lines you can read: "accent colour only on
   prices, selection and the main action". Every run reads them first. Edit a line and it's yours, × forgets it,
   Re-read all relearns from every design, and one switch turns the whole thing off.

Nothing you made is ever overwritten. Every round is a new version, so every change has a before and an after.

## Taste

Each time a version lands from notes, or a take is picked, a small model (Claude Haiku by default, a few seconds, a
fraction of a cent) reads your profile and that design's whole journey so far, and either adds a line, says it's more sure of one,
or drops one this contradicts. Each line keeps the designs it came from, and how sure it is (how many designs back
it) shows as dots. A line is about every design ("Everywhere") or
this project's own brand ("This project"); click to switch. Lines you write or edit are never dropped by learning.

The first take on a `/try` note leans on your taste. The others know it, but their own take comes first, so the
takes still differ.

The profile is `taste.json` in this folder, never committed. `ATELIER_TASTE_MODEL` picks the model that learns.

## Agents

Any coding agent with a command line works. Claude Code is the default, run headless (`claude -p`) in the project's
`scenes/` folder, allowed to read and edit files there and nothing else. Runs show on the screens they work on (a faint light circling the screen, and a line
under it with its plan and steps, with Stop and Instead… to redirect it).

- `ATELIER_AGENT=gemini python3 serve.py` runs Gemini CLI instead; `ATELIER_AGENT=codex` runs Codex. The runs,
  the critic and the taste reads all use it, and replies on the notes are signed with its name.
- `ATELIER_MODEL=sonnet python3 serve.py` picks Claude's model.
- `ATELIER_AGENT="your-agent --flags" python3 serve.py` runs any other agent. It gets the prompt on stdin;
  each line it prints shows as its activity. End its output with the JSON block the prompt asks for and replies land
  on the notes.
- Prefer your own agent session? Copy brief (Notes tab) puts every open note on the clipboard, with where it is,
  what's under it and the controls you moved. Or tell your agent to "check the notes": `AGENTS.md` says how.

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
      notes/            notes, snapshots, agent runs (never committed)
    exports/            PNG, GIF, MP4 and shared pages
  atelier/              this tool
```

**New project** (top of the panel, or on Home) makes `<name>/scenes/` from `starter/`. To add a design by hand, copy
a scene file, change it, and add its name to `index.js`. `starter/first.js` explains every attribute a scene can
animate with.

`scenes(['a-v1'], ['helpers'])` loads `scenes/helpers.js` before the designs, for code they share. A project's
typefaces go in `scenes/fonts.css`.

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
- `agent.js`, `agent.css` the agent on the stage: sending notes, takes, picking and history.
- `serve.py` the server: projects, notes, picks, exports. `agent.py` runs the agents. `page.py` writes shared pages.
- `taste.py`, `taste.js` the taste profile: learning from picks and notes, and the Taste tab.
- `capture.mjs` exports, in a hidden Chrome. `starter/` what a new project starts from. `examples/` sample projects.

Everything stays on your computer: the server only listens on 127.0.0.1.

## License

MIT. See [LICENSE](LICENSE).
