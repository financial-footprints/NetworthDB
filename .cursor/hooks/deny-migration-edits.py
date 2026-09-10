#!/usr/bin/env python3
"""Block AI edits and generation commands for Drizzle migrations."""

from __future__ import annotations

import json
import re
import sys

MIGRATIONS_SEGMENT = "/drizzle/migrations"
DENY_MESSAGE = (
    "Drizzle migrations are read-only for AI assistants. "
    "Edit schema in src/packages/database/src/schema/, then run "
    "`make migrations name=<name>` manually after review."
)

MIGRATION_SHELL_PATTERNS = (
    re.compile(r"\bmake\s+migrations\b"),
    re.compile(r"\bdrizzle-kit\s+generate\b"),
    re.compile(r"\bbun\b[^\n]*\bdrizzle-kit\b[^\n]*\bgenerate\b"),
    re.compile(r"\bbun\s+run\b[^\n]*@ndb/database\b[^\n]*\bgenerate\b"),
)


def is_migration_path(path: str) -> bool:
    if not path:
        return False
    normalized = path.replace("\\", "/")
    return MIGRATIONS_SEGMENT in normalized or normalized.endswith(
        "/drizzle/migrations"
    )


def matches_migration_shell_command(command: str) -> bool:
    return any(pattern.search(command) for pattern in MIGRATION_SHELL_PATTERNS)


def deny(agent_message: str | None = None) -> None:
    message = agent_message or DENY_MESSAGE
    json.dump(
        {
            "permission": "deny",
            "user_message": DENY_MESSAGE,
            "agent_message": message,
        },
        sys.stdout,
    )
    sys.exit(2)


def allow() -> None:
    json.dump({"permission": "allow"}, sys.stdout)
    sys.exit(0)


def parse_tool_input(raw: object) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        allow()

    hook_event = data.get("hook_event_name", "")
    tool_name = data.get("tool_name", "")
    command = data.get("command", "")

    if hook_event == "beforeShellExecution" or (not tool_name and command):
        if matches_migration_shell_command(command):
            deny(
                "Do not run migration generation commands. "
                "Tell the user to run `make migrations name=<name>` manually."
            )
        allow()

    tool_input = parse_tool_input(data.get("tool_input"))

    if tool_name in {"Write", "Delete"}:
        path = tool_input.get("path") or tool_input.get("file_path") or ""
        if is_migration_path(path):
            deny()

    if tool_name == "Shell":
        shell_command = tool_input.get("command", "")
        if matches_migration_shell_command(shell_command) or is_migration_path(
            shell_command
        ):
            deny(
                "Do not run migration generation commands. "
                "Tell the user to run `make migrations name=<name>` manually."
            )

    allow()


if __name__ == "__main__":
    main()
