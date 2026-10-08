#!/bin/sh
# Canonical copy of the v2 pre-push hook. Copy this file to .git/hooks/pre-push and
# chmod +x it after a fresh clone. See docs/runbooks/render-static-site.md "Branches and
# deployment" for the full rationale and the verification one-liner.
ZERO_SHA="0000000000000000000000000000000000000000"
remote="$1"

# One-off v1-branch cleanup exception (see docs/runbooks/render-static-site.md "v1 branch
# cleanup"). Enable with V2_BRANCH_CLEANUP=1 for the single git push --delete call. Only
# refs under refs/heads/(chore|feature)/sprint-* are allowed through; main, v2, and tags
# never match this exception.
cleanup_mode="${V2_BRANCH_CLEANUP:-0}"
is_sprint_branch_delete() {
    case "$1" in
        refs/heads/chore/sprint-*|refs/heads/feature/sprint-*) return 0 ;;
    esac
    return 1
}

while read -r local_ref local_sha remote_ref remote_sha; do
    if [ "$remote_ref" = "refs/heads/main" ]; then
        echo "pre-push: refusing push to $remote_ref (v2 workflow forbids direct main pushes)." >&2
        exit 1
    fi
    if [ "$local_sha" = "$ZERO_SHA" ]; then
        if [ "$cleanup_mode" = "1" ] && is_sprint_branch_delete "$remote_ref"; then
            echo "pre-push: V2_BRANCH_CLEANUP=1 → allowing deletion of $remote_ref." >&2
            continue
        fi
        echo "pre-push: refusing remote-ref deletion of $remote_ref." >&2
        exit 1
    fi
    if [ "$remote_sha" != "$ZERO_SHA" ]; then
        if ! git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null; then
            echo "pre-push: refusing non-fast-forward push to $remote_ref." >&2
            echo "pre-push:   local  = $local_sha" >&2
            echo "pre-push:   remote = $remote_sha" >&2
            exit 1
        fi
    fi
done

exit 0
