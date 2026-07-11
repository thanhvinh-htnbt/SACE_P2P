# Git hooks

Auto-runs `git submodule update --init --recursive` after `pull`/`checkout` so
`extensions/cocos-mcp-server` never ends up empty on a fresh clone.

Each teammate enables this **once**, in the project root:

```
git config core.hooksPath .githooks
```

Then a normal `git pull` will keep the submodule populated automatically.
