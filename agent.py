"""Claude on the canvas: runs a coding agent on a project's scenes and reports what it's doing, for serve.py.

Two kinds of run, and both start the same way: the design is copied as its next version first, and the agent
only ever changes the copy. Nothing you made is overwritten, and every round leaves a before and an after.

    notes     the open notes on one design. The copy answers them; each note gets a reply and is marked done.
    explore   one prompt, two to four agents at once, each on its own copy and its own angle. You pick one.

The agent is Claude Code, run headless (claude -p) in the project's scenes/ folder, allowed to read and edit files
there and nothing else. It is the same Claude you sign in to in the terminal: no API key. Set ATELIER_AGENT to run
another command instead: it gets the prompt on stdin, and each line it prints shows as its activity.

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

LOCK = threading.Lock()
RUNS = {}       # run id -> run, for every project, newest last
PROCS = {}      # run id -> the agent's process, while it runs
MAX_KEPT = 40   # runs kept per project in agent.json

# Directions for an exploration: each agent gets one, so three agents don't make one idea three times.
ANGLES = [
    ('Direct', 'the most direct answer to the brief: what a strong designer would ship first'),
    ('Bold', 'a bolder, less expected answer: push scale, contrast or layout further than feels safe'),
    ('Quiet', 'a quieter, reduced answer: take things away until only what matters is left'),
    ('Moving', 'an answer that leans on motion: use the steps and the timeline to make the idea land'),
]

PRIMER = """A scene is one JavaScript file that pushes one object onto SCENES:
  id, title, version, note    the scene's id (the file's name), the design's title, 'v3', a one-line note
  steps                       [{ label, dur }] one entry per step of the timeline, dur in seconds
  html                        the markup, built once and driven by the timeline
  css                         styles, scoped to this scene's screen (.scene is the root)
  controls                    optional knobs: { key, label, type: range|seg|color|toggle, value, css: '--var' | attr }
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
    custom = (os.environ.get('ATELIER_AGENT') or os.environ.get('WORKSPACE_AGENT') or '').strip()
    if custom:
        return shlex.split(custom), False, prompt
    claude = shutil.which('claude') or next((p for p in (
        '/opt/homebrew/bin/claude', '/usr/local/bin/claude', os.path.expanduser('~/.local/bin/claude'),
        os.path.expanduser('~/.claude/local/claude')) if os.path.exists(p)), None)
    if not claude:
        return None, True, None
    cmd = [claude, '-p', prompt, '--output-format', 'stream-json', '--verbose',
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
    def start(self, project, base, *, kind, scene, parent, prompt, notes=None, numbers=None, group=None, angle=None, label='', prepare=None):
        """Start one agent on <scene>.js (already copied from <parent>.js). Returns the run, or None with a reason."""
        cmd, stream, stdin = agent_command(prompt)
        run = {'id': f'r{now()}{len(RUNS)}', 'project': project, 'kind': kind, 'scene': scene, 'from': parent,
               'notes': notes or [], 'numbers': numbers or {}, 'group': group, 'angle': angle, 'label': label, 'status': 'starting',
               'activity': 'Starting', 'steps': 0, 'started': now(), 'ended': None, 'summary': '', 'name': '',
               'error': '', 'cost': None}
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

    def _go(self, run, base, cmd, stream, stdin):
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
                run['activity'] = line[:80].replace(f"{run['scene']}.js", 'the design').replace(f"{run['from']}.js", 'the original')
                text.append(line)
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get('type') == 'assistant':
                for block in (msg.get('message') or {}).get('content') or []:
                    if block.get('type') == 'tool_use':
                        run['steps'] += 1
                        # in the designer's words: the copy is "the design", the version it came from "the original"
                        run['activity'] = activity_of(block).replace(f"{run['scene']}.js", 'the design').replace(f"{run['from']}.js", 'the original')
                    elif block.get('type') == 'text' and block.get('text', '').strip():
                        text.append(block['text'])
                        run['activity'] = 'Thinking'
            elif msg.get('type') == 'result':
                result = msg
        proc.wait()
        err = proc.stderr.read().strip() if proc.stderr else ''
        with LOCK:
            PROCS.pop(run['id'], None)
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
                    n.setdefault('replies', []).append({'who': 'Claude', 'text': str(said)[:400], 'at': now(), 'run': run['id'], 'made': run['scene']})
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

The designer left notes on the design in {parent}.js. It has been copied to {scene}.js for this round. Make the
changes in {scene}.js only. Never change {parent}.js or any other file. Keep the id '{scene}' and the version as they are.

{PRIMER}

The notes, numbered as they are on screen. Each says where it was pinned and what was under it. Snapshots are in
notes/snaps/ if you need to see what the designer saw.

{brief_lines}
{extra}
Make each change the way a careful designer would: match the design's existing spacing, type and colour, and keep the
animation working. When you're done, end your reply with this JSON block and nothing after it:

```json
{{"replies": {{{', '.join(f'"{k}": "one short line on what you changed"' for k in numbered)}}}, "summary": "one line for the version history"}}
```"""


def explore_prompt(scene, parent, ask, k, n, angle, focus='', taste=''):
    where = f"\nOnly redesign this part: {focus}. Leave everything else in the scene as it is.\n" if focus else ''
    return f"""You're working inside Atelier, a stage where a designer explores directions with several agents at once.

The design in {parent}.js has been copied to {scene}.js. Change {scene}.js only. Never change {parent}.js or any
other file. Keep the id '{scene}', the title and the version as they are.

{PRIMER}

The designer asked for: {ask}
{where}
You are direction {k} of {n}. The others are being made right now by other agents, from the same starting point.
Your angle: {angle}. Make it a real direction that looks clearly different from the starting point, not a tweak,
and keep it working: every step should still play. Set the scene's note: to a 2 to 4 word name for your direction.

{taste}
When you're done, end your reply with this JSON block and nothing after it:

```json
{{"name": "2 to 4 word name for this direction", "summary": "one line on what you did and why"}}
```"""
