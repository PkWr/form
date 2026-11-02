#!/bin/sh
# Keeps this folder level with GitHub. Run it before you open the folder or start work.
# It only ever fast-forwards: it will not overwrite local changes, and it says plainly if the two have drifted apart.
set -e
cd "$(dirname "$0")/.."
git fetch origin --quiet
branch=$(git rev-parse --abbrev-ref HEAD)
ahead=$(git rev-list --count "origin/$branch..HEAD")
behind=$(git rev-list --count "HEAD..origin/$branch")
dirty=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$ahead" = 0 ] && [ "$behind" = 0 ]; then echo "Level with GitHub ($(git log --oneline -1))."
elif [ "$ahead" = 0 ] && [ "$dirty" = 0 ]; then git merge --ff-only "origin/$branch" --quiet && echo "Brought up to date: $behind new commit(s). Now at $(git log --oneline -1)."
elif [ "$ahead" = 0 ]; then echo "GitHub has $behind new commit(s) but this folder has uncommitted changes. Commit or put them aside, then run this again."; exit 1
else echo "This folder has $ahead commit(s) GitHub does not, and GitHub has $behind this folder does not. Nothing changed. Ask Claude to reconcile them."; exit 1; fi
