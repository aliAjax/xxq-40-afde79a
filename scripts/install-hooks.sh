#!/usr/bin/env bash
#
# 安装 Git hooks 到本地 .git/hooks 目录
# 使用方法：在项目根目录运行 ./scripts/install-hooks.sh
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

# 需要安装的钩子列表
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
        continue
    fi

    if [ -f "$target_file" ]; then
        # 检查是否相同
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
echo "  已安装/更新的 hooks: $installed"
echo ""
echo -e "${CYAN}提示：${NC}"
echo "  - 提交时会自动运行代码质量检查"
echo "  - 如需临时跳过检查，使用：git commit --no-verify"
echo "  - 如需手动运行检查，使用：git diff --check"
echo ""
