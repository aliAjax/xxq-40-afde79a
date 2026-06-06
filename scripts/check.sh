#!/usr/bin/env bash
#
# 手动运行代码质量检查（等同于 pre-commit 检查的内容）
# 使用方法：在项目根目录运行 ./scripts/check.sh
#

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}==> 运行代码质量检查...${NC}"
echo ""

exit_code=0

# 检查行尾空格
echo "  [1/2] 检查行尾空格..."
whitespace_files=""
for file in $(find . -type f \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -not -path './dist/*' \
    -not -path './build/*' \
    \( -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.json" -o -name "*.md" -o -name "*.sh" \)
); do
    if grep -q ' $' "$file" 2>/dev/null; then
        count=$(grep -c ' $' "$file")
        whitespace_files="$whitespace_files  - $file ($count 处)"$'\n'
    fi
done

if [ -n "$whitespace_files" ]; then
    echo -e "${RED}  ✗ 发现行尾空格：${NC}"
    echo "$whitespace_files"
    echo ""
    echo -e "${YELLOW}  自动修复命令：${NC}"
    echo -e "    ${YELLOW}find . -type f -name '*.js' -o -name '*.html' -o -name '*.css' -o -name '*.json' | xargs sed -i '' 's/[[:space:]]*$//'${NC}"
    echo ""
    exit_code=1
else
    echo -e "${GREEN}  ✓ 无行尾空格${NC}"
fi

# 检查冲突标记
echo ""
echo "  [2/2] 检查合并冲突标记..."
conflict_files=""
for file in $(find . -type f \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -not -path './dist/*' \
    -not -path './build/*' \
    \( -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.json" -o -name "*.md" -o -name "*.sh" \)
); do
    if grep -q '^<<<<<<< ' "$file" 2>/dev/null || grep -q '^>>>>>>> ' "$file" 2>/dev/null; then
        conflict_files="$conflict_files  - $file"$'\n'
    fi
done

if [ -n "$conflict_files" ]; then
    echo -e "${RED}  ✗ 发现合并冲突标记：${NC}"
    echo "$conflict_files"
    exit_code=1
else
    echo -e "${GREEN}  ✓ 无冲突标记${NC}"
fi

echo ""
if [ $exit_code -ne 0 ]; then
    echo -e "${RED}=================================${NC}"
    echo -e "${RED}  检查未通过 ✗${NC}"
    echo -e "${RED}=================================${NC}"
    echo ""
    exit 1
else
    echo -e "${GREEN}=================================${NC}"
    echo -e "${GREEN}  全部检查通过 ✓${NC}"
    echo -e "${GREEN}=================================${NC}"
    echo ""
    exit 0
fi
