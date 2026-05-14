#!/bin/bash
# 启动脚本：自动使用正确的 Node.js 版本（v20+）
# 解决系统默认 node (v16) 与 Vite 不兼容的问题

set -e

# 优先使用 Homebrew 安装的 Node.js (v25+)
if [ -x "/opt/homebrew/bin/node" ]; then
  NODE="/opt/homebrew/bin/node"
elif [ -x "/usr/local/bin/node" ]; then
  NODE="/usr/local/bin/node"
else
  echo "错误：未找到 Node.js，请先安装 Node.js 20+"
  exit 1
fi

NODE_VERSION=$($NODE --version)
echo "使用 Node.js: $NODE_VERSION"

# 检查版本是否满足要求 (>= 20)
MAJOR=$(echo "$NODE_VERSION" | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$MAJOR" -lt 20 ]; then
  echo "错误：Node.js 版本 $NODE_VERSION 过低，需要 20.19+"
  exit 1
fi

# 设置 PATH，确保子进程使用正确的 Node
export PATH="$(dirname "$NODE"):$PATH"

# 启动前后端
cd "$(dirname "$0")"
echo "启动开发服务器..."
npm run dev
