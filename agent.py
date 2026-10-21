"""An agent on the canvas: runs a coding agent on a project's scenes and reports what it's doing, for serve.py.

Two kinds of run, and both start the same way: the design is copied as its next version first, and the agent
only ever changes the copy. Nothing you made is overwritten, and every round leaves a before and an after.

    notes     the open notes on one design. The copy answers them; each note gets a reply and is marked done.
    try       a note that says /try 3: three agents at once, each on its own copy, each answering only that note
              and leaving the rest of the design exactly as it is. You pick one take.

Every agent says its plan in one line before it edits, so you can tell it's going the wrong way before it lands.
Redirect stops one agent and starts it again on the same copy, in the same session where the agent allows it, with your line added:
the work so far stays, and the others keep going.

Any coding agent with a command line works. Claude Code is the default, run headless (claude -p) in the project's
scenes/ folder, allowed to read and edit files there and nothing else: the same sign-in as your terminal, no API key.
ATELIER_AGENT picks another (gemini, codex, or any command): see agents.py.

Every run is kept in scenes/notes/agent.json (never committed, like the notes). What it decided is kept in
scenes/trail.json, which is worth committing: each version's parent, the notes or prompt that made it, and the picks.
"""
import json
import os
import re
import shlex
import shutil
import signal
import subprocess
import threading
import time

import agents

LOCK = threading.Lock()
RUNS = {}       # run id -> run, for every project, newest last
PROCS = {}      # run id -> the agent's process, while it runs
MAX_KEPT = 40   # runs kept per project in agent.json

# How the takes on one /try note differ, so three agents don't make one idea three times. Never shown as a choice:
# the designer sees each take's own name.
TAKES = [
    'the most literal answer to the note: what it says, done well',
    'a stronger answer: push the change further than the note strictly asks',
    'a different reading of the note: answer what it is getting at another way',
    'the smallest change that still answers the note',
]

PRIMER = """A scene is one JavaScript file that pushes one object onto SCENES:
  id, title, version, note    the scene's id (the file's name), the design's title, 'v3', a one-line note
  steps                       [{ label, dur }] one entry per step of the timeline, dur in seconds
  html                        the markup, built once and driven by the timeline
  css                         styles, scoped to this scene's screen (.scene is the root)
  controls                    optional knobs: { key, label, type: range|seg|select|color|toggle, value, css: '--var' | attr };
                              { type: 'group', label, key? } starts a named group (with key, a switch in its head)
Animation is attributes on the markup. A position is a step number plus a fraction (1.5 = halfway through step 1):
  data-in="1.5" adds class .on from 1.5 on, data-out="3" removes it, data-type="0-0.8" types the text out,
  data-state="2:a 2.5:b" sets data-s, data-focus="card" names a part so it can be compared across versions.
The root also carries data-step and --p (progress through the step, 0 to 1).
On phone and tablet sizes the design runs the full height, under the status bar and home indicator, as on a real
device: keep content clear of them with var(--safe-top) and var(--safe-bottom) (0 on desktop), backgrounds to the edges."""


def now():
    return int(time.time() * 1000)


def agent_command(prompt):
    """The command to run, and whether its output is Claude's stream-json. ATELIER_AGENT replaces Claude."""
    custom = agents.custom()
    if custom:
        return shlex.split(custom), False, prompt
    claude = shutil.which('claude') or next((p for p in (
        '/opt/homebrew/bin/claude', '/usr/local/bin/claude', os.path.expanduser('~/.local/bin/claude'),
        os.path.expanduser('~/.claude/local/claude')) if os.path.exists(p)), None)
    if not claude:
        return None, True, None
    # --setting-sources '': none of the designer's own settings or CLAUDE.md. A global "read this skill first" cost
    # every agent ~20s before it touched the design; the prompt already says everything a scene needs.
    cmd = [claude, '-p', prompt, '--output-format', 'stream-json', '--verbose', '--setting-sources', '',
           '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Edit,Write,Glob,Grep']
    model = os.environ.get('ATELIER_MODEL') or os.environ.get('WORKSPACE_MODEL')
    if model:
        cmd += ['--model', model]
    return cmd, True, None


def short_path(p):
    return os.path.basename(str(p or '')) or 'a file'


def activity_of(block):
    """One line for what a tool call is doing: 'Editing card-v3.js'."""
    name, inp = block.get('name', ''), block.get('input') or {}
    if name in ('Edit', 'MultiEdit'):
        return f"Editing {short_path(inp.get('file_path'))}"
    if name == 'Write':
        return f"Writing {short_path(inp.get('file_path'))}"
    if name == 'Read':
        return f"Reading {short_path(inp.get('file_path'))}"
    if name in ('Glob', 'Grep'):
        return 'Looking around'
    return name or 'Working'


def plan_of(text):
    """The agent's plan in one line: the line that starts with "Plan:". Nothing else counts, so a passing remark
    ("Switching to direct edits") never shows as the plan."""
    for line in (text or '').splitlines():
        m = re.match(r'\s*\**plan\**\s*:\s*\**\s*(.+)', line, re.I)
        if m:
            return plain(m.group(1).rstrip('*'), 120)
    return ''


def now_of(text):
    """Every step the agent announces: lines that start with "Now:"."""
    steps = [plain(m.group(1).rstrip('*'), 90) for m in re.finditer(r'(?im)^\s*\**now\**\s*:\s*\**\s*(.+)$', text or '')]
    # naming the direction isn't something you see change on screen
    return [x for x in steps if not re.match(r'(?i)(renam|nam(e|ing) (this|the)|set(ting)? the note)', x)]


CSS_PROP = re.compile(r'([a-z-]{3,})\s*:\s*([^;{}\n]{1,40});')


def change_of(block):
    """When an edit comes without a "Now:" line, what it changed in the CSS: 'font-size 15px → 20px'. Or ''."""
    inp = block.get('input') or {}
    old, new = str(inp.get('old_string') or ''), str(inp.get('new_string') or '')
    if not old or not new:
        return ''
    was = {k: v.strip() for k, v in CSS_PROP.findall(old)}
    out = [f'{k} {was[k]} → {v.strip()}' for k, v in CSS_PROP.findall(new) if k in was and was[k] != v.strip()]
    return ' · '.join(out[:2])[:90]


def answer_of(text):
    """The JSON block the prompt asks for at the end of the reply, or {}."""
    found = re.findall(r'```(?:json)?\s*(\{.*?\})\s*```', text or '', re.S)
    for chunk in reversed(found):
        try:
            data = json.loads(chunk)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            continue
    return {}


def plain(text, limit=240):
    """The reply without its JSON block, as one short line."""
    text = re.sub(r'```.*?```', '', text or '', flags=re.S).strip()
    text = re.sub(r'\s+', ' ', text)
    return text[:limit].rstrip() + ('…' if len(text) > limit else '')


def public(run):
    """What the page sees of a run."""
    return {k: v for k, v in run.items() if not k.startswith('_')}


def kept_runs(base):
    path = os.path.join(base, 'notes', 'agent.json')
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return []


def busy(project, scene):
    """Whether an agent is working on that design right now. It can't be duplicated until the agent is done."""
    with LOCK:
        return any(r['project'] == project and r.get('scene') == scene and r['status'] in ('starting', 'working') for r in RUNS.values())


def runs_for(project, base):
    """Every run for a project: the ones in memory, then the ones kept on disk from before the server started."""
    with LOCK:
        live = [public(r) for r in RUNS.values() if r['project'] == project]
    ids = {r['id'] for r in live}
    old = [r for r in kept_runs(base) if isinstance(r, dict) and r.get('id') not in ids]
    for r in old:  # a run that was going when the server stopped never finished
        if r.get('status') in ('starting', 'working'):
            r['status'], r['error'] = 'stopped', 'The Atelier server stopped while this ran'
    out = sorted(old + live, key=lambda r: r.get('started', 0))
    for r in out:  # the file as it is now, so the page reloads a design the moment the agent saves it
        path = os.path.join(base, f"{r.get('scene', '')}.js")
        r['mtime'] = str(os.stat(path).st_mtime_ns) if os.path.isfile(path) else '0'
    return out


class Runner:
    """Starts runs and writes their results back. serve.py hands it the helpers it already has."""

    def __init__(self, write_atomic, read_json, writes_lock):
        self.write_atomic, self.read_json, self.writes = write_atomic, read_json, writes_lock
        self.on_done = None  # called with (run, base) when a run ends: serve.py learns taste from it

    # ---------- files ----------
    def save_runs(self, project, base):
        with LOCK:
            mine = [public(r) for r in RUNS.values() if r['project'] == project]
        ids = {r['id'] for r in mine}
        older = [r for r in kept_runs(base) if isinstance(r, dict) and r.get('id') not in ids]
        allruns = sorted(older + mine, key=lambda r: r.get('started', 0))[-MAX_KEPT:]
        for r in allruns:
            r.pop('mtime', None)
        path = os.path.join(base, 'notes', 'agent.json')
        self.write_atomic(path, json.dumps(allruns, indent=2, ensure_ascii=False) + '\n')
        ignore = os.path.join(base, 'notes', '.gitignore')
        if not os.path.exists(ignore):
            self.write_atomic(ignore, '*\n')

    def trail_add(self, base, entry):
        path = os.path.join(base, 'trail.json')
        with self.writes:
            trail = self.read_json(path, [])
            trail.append(entry)
            self.write_atomic(path, json.dumps(trail, indent=2, ensure_ascii=False) + '\n')

    def trail_update(self, base, match, change):
        path = os.path.join(base, 'trail.json')
        with self.writes:
            trail = self.read_json(path, [])
            for e in trail:
                if isinstance(e, dict) and match(e):
                    change(e)
            self.write_atomic(path, json.dumps(trail, indent=2, ensure_ascii=False) + '\n')

    def notes_change(self, base, change):
        """Change notes.json under the same lock the page's saves use; the page picks it up on its next poll."""
        path = os.path.join(base, 'notes', 'notes.json')
        with self.writes:
            notes = self.read_json(path, [])
            change(notes)
            self.write_atomic(path, json.dumps(notes, indent=2, ensure_ascii=False) + '\n')

    # ---------- runs ----------
    def start(self, project, base, *, kind, scene, parent, prompt, notes=None, numbers=None, group=None, angle=None, label='', prepare=None, round=''):
        """Start one agent on <scene>.js (already copied from <parent>.js). Returns the run, or None with a reason."""
        cmd, stream, stdin = agent_command(prompt)
        run = {'id': f'r{now()}{len(RUNS)}', 'project': project, 'kind': kind, 'scene': scene, 'from': parent,
               'notes': notes or [], 'numbers': numbers or {}, 'group': group, 'round': round, 'angle': angle, 'label': label, 'status': 'starting',
               'activity': 'Starting', 'plan': '', 'log': [], 'redirects': [], 'steps': 0, 'started': now(), 'ended': None,
               'summary': '', 'name': '', 'error': '', 'cost': None}
        if not cmd:
            run.update(status='failed', ended=now(), error='Claude Code was not found. Install it, then run claude once to sign in.')
        with LOCK:
            RUNS[run['id']] = run
        self.save_runs(project, base)
        path = os.path.join(base, f'{scene}.js')
        run['_born'] = os.stat(path).st_mtime_ns if os.path.isfile(path) else 0
        if run['status'] == 'failed':
            self.drop_copy(run, base)
            return run
        if prepare:
            prepare(run)
        run['_prompt'] = prompt
        threading.Thread(target=self._go, args=(run, base, cmd, stream, stdin), daemon=True).start()
        return run

    def stop(self, run_id):
        with LOCK:
            proc, run = PROCS.get(run_id), RUNS.get(run_id)
        if not run or run['status'] not in ('starting', 'working'):
            return False
        run['_stopped'] = True
        if proc:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                proc.terminate()
        return True

    def redirect(self, run_id, line):
        """Stop one agent and start it again with the designer's line. Its copy keeps what it has done so far."""
        line = re.sub(r'\s+', ' ', str(line or '')).strip()[:400]
        with LOCK:
            proc, run = PROCS.get(run_id), RUNS.get(run_id)
        if not line or not run or run['status'] not in ('starting', 'working') or run.get('_stopped'):
            return False
        run['_redirect'] = line
        run['activity'] = 'Redirecting'  # the plan stays until the agent says its new one; the line shows as ↪ in the log
        if proc:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                proc.terminate()
        return True

    def _again(self, run, base, line):
        """The command that carries on after a redirect: the same Claude session resumed, or for another agent the
        first prompt with the line added."""
        run['redirects'].append({'text': line, 'at': now(), 'step': run['steps']})
        run['log'].append({'text': line, 'at': now(), 'redirect': True})
        self.trail_update(base, lambda e: e.get('id') == run['scene'],
                          lambda e: e.setdefault('redirects', []).append({'text': line, 'at': now()}))
        ask = redirect_prompt(run['scene'], line, run['kind'])
        cmd, stream, stdin = agent_command(ask)
        if stream and run.get('_session'):
            cmd += ['--resume', run['_session']]
            return cmd, stream, stdin
        return agent_command(run.get('_prompt', '') + '\n\n' + ask)

    def _go(self, run, base, cmd, stream, stdin):
        while True:
            again = self._once(run, base, cmd, stream, stdin)
            if again is None:
                return
            cmd, stream, stdin = again

    def _once(self, run, base, cmd, stream, stdin):
        """One go of the agent. Returns the next command after a redirect, or None once the run has ended."""
        text, result = [], None
        try:
            proc = subprocess.Popen(cmd, cwd=base, stdin=subprocess.PIPE if stdin else subprocess.DEVNULL,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1,
                                    start_new_session=True, env={**os.environ, 'ATELIER_RUN': run['id']})
        except OSError as e:
            return self._finish(run, base, error=f'Could not start the agent: {e}')
        with LOCK:
            PROCS[run['id']] = proc
        if stdin:
            try:
                proc.stdin.write(stdin)
                proc.stdin.close()
            except OSError:
                pass
        run.update(status='working', activity='Reading the design')
        self.save_runs(run['project'], base)
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            if not stream:
                if re.match(r'\s*plan\s*:', line, re.I):
                    run['plan'] = plan_of(line)
                run['log'] += [{'text': x, 'at': now()} for x in now_of(line)]
                run['activity'] = line[:80].replace(f"{run['scene']}.js", 'the design').replace(f"{run['from']}.js", 'the original')
                text.append(line)
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get('session_id'):
                run['_session'] = msg['session_id']
            if msg.get('type') == 'assistant':
                for block in (msg.get('message') or {}).get('content') or []:
                    if block.get('type') == 'tool_use':
                        if block.get('name') in ('Edit', 'MultiEdit', 'Write'):
                            if run.get('_said'):
                                run.pop('_said')
                            else:  # an edit with no "Now:" line before it: say what it changed, if it's readable
                                said = change_of(block)
                                if said:
                                    run['log'].append({'text': said, 'at': now()})
                        run['steps'] += 1
                        # in the designer's words: the copy is "the design", the version it came from "the original"
                        run['activity'] = activity_of(block).replace(f"{run['scene']}.js", 'the design').replace(f"{run['from']}.js", 'the original')
                    elif block.get('type') == 'text' and block.get('text', '').strip():
                        text.append(block['text'])
                        run['activity'] = 'Thinking'
                        said = plan_of(block['text'])
                        if said:
                            run['plan'] = said
                        for step in now_of(block['text']):
                            run['log'].append({'text': step, 'at': now()})
                            run['_said'] = True
            elif msg.get('type') == 'result':
                result = msg
        proc.wait()
        err = proc.stderr.read().strip() if proc.stderr else ''
        with LOCK:
            PROCS.pop(run['id'], None)
        line = run.pop('_redirect', None)
        if line and not run.get('_stopped'):
            again = self._again(run, base, line)
            if again[0]:
                run.update(status='working', activity='Redirecting')
                self.save_runs(run['project'], base)
                return again
        # each way out finishes the run once: a second _finish wrote the replies and the trail twice and moved a
        # round on twice
        if run.get('_stopped'):
            return self._finish(run, base, error='Stopped', status='stopped')
        if result is not None:
            reply = result.get('result') or '\n'.join(text)
            run['cost'] = result.get('total_cost_usd')
            if result.get('is_error'):
                msg = reply or 'The agent stopped with an error'
                if re.search(r'authenticat|log ?in|OAuth|API key', msg, re.I):
                    msg = 'Claude needs you to sign in: run claude in a terminal, then /login'
                return self._finish(run, base, error=msg[:300])
            return self._finish(run, base, reply=reply)
        if proc.returncode != 0:
            return self._finish(run, base, error=(err.splitlines() or ['The agent stopped'])[-1][:300])
        return self._finish(run, base, reply='\n'.join(text))

    def _finish(self, run, base, reply='', error='', status=None):
        run['ended'] = now()
        if error:
            run.update(status=status or 'failed', error=error, activity='')
            if run['kind'] == 'notes':
                self.fail_notes(run, base)
            if not self.drop_copy(run, base):
                self.trail_update(base, lambda e: e.get('id') == run['scene'], lambda e: e.update(status=run['status']))
        else:
            data = answer_of(reply)
            run.update(status='done', activity='', summary=str(data.get('summary') or plain(reply, 160))[:200],
                       name=str(data.get('name') or '')[:48])
            self._record(run, base, data, reply)
        self.save_runs(run['project'], base)
        if self.on_done:
            try:
                self.on_done(run, base)
            except Exception:  # learning is a bonus: it never breaks a run
                pass

    def _record(self, run, base, data, reply):
        """A finished run: replies on its notes, and a line in the trail."""
        if run['kind'] == 'notes' and run['notes']:
            replies = data.get('replies') if isinstance(data.get('replies'), dict) else {}
            fallback = plain(reply, 200) or 'Done.'

            def answer(notes):
                for n in notes:
                    if not isinstance(n, dict) or n.get('id') not in run['notes']:
                        continue
                    num = run['numbers'].get(str(n.get('id')))
                    said = replies.get(str(num)) or replies.get(str(n.get('id'))) or fallback
                    n.setdefault('replies', []).append({'who': agents.name(), 'text': str(said)[:400], 'at': now(), 'run': run['id'], 'made': run['scene']})
                    n['done'] = True
                    n.pop('sent', None)
            self.notes_change(base, answer)
        self.trail_update(base, lambda e: e.get('id') == run['scene'],
                          lambda e: e.update(status='done', summary=run['summary'], name=run['name'] or e.get('name', '')))

    def drop_copy(self, run, base):
        """A run that ended before changing its copy leaves nothing behind: the copy, its line in index.js and its
        trail entry go, so a failed round doesn't leave a version that is the same as its parent."""
        path = os.path.join(base, f"{run['scene']}.js")
        try:
            if not os.path.isfile(path) or os.stat(path).st_mtime_ns != run.get('_born'):
                return False
        except OSError:
            return False
        with self.writes:
            index = os.path.join(base, 'index.js')
            with open(index, encoding='utf-8') as f:
                text = f.read()
            found = re.search(r'scenes\(\s*\[(.*?)\]', text, re.S)
            if found:
                inner = re.sub(r'\s*,?\s*([\'"])' + re.escape(run['scene']) + r'\1', '', found.group(1), count=1).lstrip(', ')
                self.write_atomic(index, text[:found.start(1)] + inner + text[found.end(1):])
            os.remove(path)
            trail = self.read_json(os.path.join(base, 'trail.json'), [])
            self.write_atomic(os.path.join(base, 'trail.json'), json.dumps([e for e in trail if not (isinstance(e, dict) and e.get('id') == run['scene'])], indent=2, ensure_ascii=False) + '\n')
        run['removed'] = True
        return True

    def fail_notes(self, run, base):
        """A notes run that didn't finish leaves its notes open, so they can be sent again."""
        def reopen(notes):
            for n in notes:
                if isinstance(n, dict) and n.get('sent') == run['id']:
                    n.pop('sent', None)
        self.notes_change(base, reopen)


def notes_prompt(scene, parent, numbered, brief_lines, extra=''):
    return f"""You're working inside Atelier, a stage where a designer reviews designs and leaves notes on them.

Your first output, before any tool call, is one line that starts with "Plan:" and says in under 15 words what
will change on screen, in a designer's words (not file names). The designer reads it while you work and can redirect you.

The designer left notes on the design in {parent}.js. It has been copied to {scene}.js for this round. Make the
changes in {scene}.js only. Never change {parent}.js or any other file. Keep the id '{scene}' and the version as they are.

{PRIMER}

The notes, numbered as they are on screen. Each says where it was pinned and what was under it. Snapshots are in
notes/snaps/ if you need to see what the designer saw.

{brief_lines}
{extra}
Make each change the way a careful designer would: match the design's existing spacing, type and colour, and keep the
animation working.

Work in small visible steps, so the designer watches the screen change as you go: one visible change per edit (a
size, a colour, a layout move), saved before the next. Before each edit, write one line that starts with "Now:" and
says in under 8 words what that edit changes on screen. Never rewrite the whole file in one go. When you're done, end your reply with this JSON block and nothing after it:

```json
{{"replies": {{{', '.join(f'"{k}": "one short line on what you changed"' for k in numbered)}}}, "summary": "one line for the version history"}}
```"""


def try_prompt(scene, parent, note, k, n, taste=''):
    return f"""You're working inside Atelier, a stage where a designer reviews designs and leaves notes on them.

Your first output, before any tool call, is one line that starts with "Plan:" and says in under 15 words what
will change on screen, in a designer's words (not file names). The designer reads it while you work and can redirect you.

The design in {parent}.js has been copied to {scene}.js. Change {scene}.js only. Never change {parent}.js or any
other file. Keep the id '{scene}', the title and the version as they are.

{PRIMER}

The designer left one note they're unsure about and asked for {n} takes on it. You make take {k} of {n}; the others
are being made right now from the same starting point.

{note}

Change only what this note is about. Everything else on screen stays exactly as it is: same layout, type, colour and
spacing outside that part, so the takes can be compared on this one thing. Your take: {TAKES[(k - 1) % len(TAKES)]}.
Set the scene's note: to a 2 to 4 word name for your take.

Work in small visible steps, so the designer watches the screen change as you go: one visible change per edit (a
size, a colour, a layout move), saved before the next. Before each edit, write one line that starts with "Now:" and
says in under 8 words what that edit changes on screen. Never rewrite the whole file in one go.

{taste}
When you're done, end your reply with this JSON block and nothing after it:

```json
{{"name": "2 to 4 word name for this take", "summary": "one line on what you changed"}}
```"""


def redirect_prompt(scene, line, kind):
    end = ('the same JSON block as before: {"replies": {...}, "summary": "..."}' if kind == 'notes'
           else 'the same JSON block as before: {"name": "...", "summary": "..."}')  # a take
    return f"""The designer watched you work and redirected you: "{line}"

Carry on in {scene}.js only, from where it is now: keep what still fits, change what the line asks for. Your first
output, before any tool call, is one line that starts with "Plan:" for what you'll do now, in under 15 words.
Then keep working in small steps, one visible change per edit, each with its "Now:" line first. When you're done, end your reply with {end}, and nothing
after it."""
