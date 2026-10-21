"""Which coding agent Atelier runs. Claude Code by default; ATELIER_AGENT picks another, for the runs, the critic
and the taste reads alike.

    ATELIER_AGENT=gemini      Gemini CLI, edits approved (gemini --yolo)
    ATELIER_AGENT=codex       Codex CLI (codex exec --full-auto -)
    ATELIER_AGENT='my-agent --flag'   any command: it gets the prompt on stdin, prints its activity line by line,
                              and ends with the same JSON block Claude would. ATELIER_TASK says which job it is.

ATELIER_AGENT_NAME sets the name its replies are signed with; otherwise it's the preset or the command's name.
"""
import os
import re
import shlex

PRESETS = {
    'gemini': 'gemini --yolo',
    'codex': 'codex exec --full-auto --skip-git-repo-check -',
}


def chosen():
    return (os.environ.get('ATELIER_AGENT') or os.environ.get('WORKSPACE_AGENT') or '').strip()


def custom():
    """The command to run instead of Claude Code, or '' for Claude Code."""
    v = chosen()
    return PRESETS.get(v.lower(), v)


def name():
    """Who signs the replies on a note."""
    if os.environ.get('ATELIER_AGENT_NAME'):
        return os.environ['ATELIER_AGENT_NAME']
    v = chosen()
    if not v:
        return 'Claude'
    if v.lower() in PRESETS:
        return v.capitalize()
    words = shlex.split(v)
    if len(words) > 1 and re.match(r'(python|node|bash|sh|deno|bun)\d*$', os.path.basename(words[0])):
        words = words[1:]  # python3 my-agent.py is my-agent
    base = os.path.basename(words[0]).rsplit('.', 1)[0]
    return base[:1].upper() + base[1:] if base else 'Agent'
