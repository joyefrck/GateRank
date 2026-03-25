#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-origin}"

info() {
  printf "\033[1;34m[deploy]\033[0m %s\n" "$1"
}

fail() {
  printf "\033[1;31m[deploy]\033[0m %s\n" "$1" >&2
  exit 1
}

require_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    fail "工作区不干净。请先提交或处理本地改动后再发布。"
  fi
}

require_branch() {
  local current_branch
  current_branch="$(git branch --show-current)"
  if [[ "$current_branch" != "$BRANCH" ]]; then
    fail "当前分支是 '$current_branch'，生产发布要求在 '$BRANCH' 上执行。"
  fi
}

show_post_push_steps() {
  cat <<'EOF'

下一步请到 1Panel 执行：
1. 打开「容器」->「编排」
2. 找到编排：gaterank
3. 点击「重启」

当前线上 gaterank 编排会在启动时重新从 GitHub 拉取最新代码：
- gaterank-web
- gaterank-api

重启完成后，建议回查：
- https://gate-rank.com/
- https://gate-rank.com/methodology
EOF
}

info "检查分支和工作区"
require_branch
require_clean_worktree

info "拉取远端最新提交"
git fetch "$REMOTE"

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "$REMOTE/$BRANCH")"

if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  info "本地与远端有差异，继续执行发布前校验"
else
  info "本地与远端已一致，仍会执行校验并推送以确认发布状态"
fi

info "运行 TypeScript 检查"
npm run lint

info "构建前端产物"
npm run build

info "推送到 $REMOTE/$BRANCH"
git push "$REMOTE" "$BRANCH"

info "GitHub 推送完成"
show_post_push_steps
