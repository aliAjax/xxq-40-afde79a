#!/usr/bin/env bash
#
# 安装 Git hooks 到本地 .git/hooks 目录
#
# 使用方法：
#   ./scripts/install-hooks.sh
#   npm run install-hooks
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GIT_HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}==> 安装 Git hooks...${NC}"
echo ""

if [ ! -d "$GIT_HOOKS_DIR" ]; then
    echo "  创建 hooks 目录..."
    mkdir -p "$GIT_HOOKS_DIR"
fi

hooks=(
    "pre-commit"
)

installed=0
skipped=0

for hook in "${hooks[@]}"; do
    source_file="$SCRIPT_DIR/$hook"
    target_file="$GIT_HOOKS_DIR/$hook"

    if [ ! -f "$source_file" ]; then
        echo -e "  ${YELLOW}⚠ 跳过 $hook：源文件不存在${NC}"
        skipped=$((skipped + 1))
        continue
    fi

    if [ -f "$target_file" ]; then
        if diff -q "$source_file" "$target_file" >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓ $hook 已是最新${NC}"
            installed=$((installed + 1))
            continue
        else
            echo -e "  ${YELLOW}更新 $hook...${NC}"
        fi
    else
        echo -e "  安装 $hook..."
    fi

    cp "$source_file" "$target_file"
    chmod +x "$target_file"
    installed=$((installed + 1))
done

echo ""
echo -e "${GREEN}==> 完成！${NC}"
echo ""
echo "  已安装/更新: $installed 个"
echo "  跳过: $skipped 个"
echo ""
echo -e "${CYAN}质量门禁（5 项检查）：${NC}"
echo "  1. JS 语法检查"
echo "  2. 行尾空格检查"
echo "  3. 合并冲突标记检查"
echo "  4. 脚本可执行权限检查"
echo "  5. 单元测试"
echo ""
echo -e "${CYAN}常用命令：${NC}"
echo "  npm test              # 运行全量质量门禁（5 项）"
echo "  npm run test-only     # 只运行单元测试"
echo "  npm run check         # 运行全量质量门禁（同 npm test）"
echo "  git commit            # 提交时自动运行质量门禁"
echo "  git commit --no-verify  # 跳过检查（不推荐）"
echo ""
