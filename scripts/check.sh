#!/usr/bin/env bash
#
# 统一代码质量门禁
# 检查项：JS 语法、行尾空格、冲突标记、脚本可执行权限、单元测试
#
# 使用方法：
#   ./scripts/check.sh          # 检查所有项目文件 + 跑测试
#   ./scripts/check.sh --no-test  # 只检查文件，不跑测试
#   ./scripts/check.sh <files>  # 检查指定文件列表（用空格分隔）
#
# 退出码：0 全部通过，1 有未通过项

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

RUN_TESTS=true
SPECIFIC_FILES=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-test)
            RUN_TESTS=false
            shift
            ;;
        *)
            SPECIFIC_FILES+=("$1")
            shift
            ;;
    esac
done

cd "$PROJECT_ROOT"

if [ ${#SPECIFIC_FILES[@]} -gt 0 ]; then
    files_input=()
    for f in "${SPECIFIC_FILES[@]}"; do
        if [ -f "$f" ]; then
            files_input+=("$f")
        fi
    done
    FILES_MODE="specific"
else
    FILES_MODE="all"
fi

is_text_file() {
    local file="$1"
    case "$file" in
        *.js|*.html|*.css|*.json|*.md|*.sh)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

is_js_file() {
    local file="$1"
    case "$file" in
        *.js)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

is_shell_script() {
    local file="$1"
    case "$file" in
        *.sh)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

should_check_file() {
    local file="$1"
    if [[ "$file" == .git/* ]]; then return 1; fi
    if [[ "$file" == node_modules/* ]]; then return 1; fi
    if [[ "$file" == dist/* ]]; then return 1; fi
    if [[ "$file" == build/* ]]; then return 1; fi
    return 0
}

collect_files() {
    local mode="$FILES_MODE"
    if [ "$mode" = "specific" ]; then
        for f in "${files_input[@]}"; do
            if should_check_file "$f"; then
                echo "$f"
            fi
        done
    else
        find . -type f \
            -not -path './.git/*' \
            -not -path './node_modules/*' \
            -not -path './dist/*' \
            -not -path './build/*' \
            \( -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.json" -o -name "*.md" -o -name "*.sh" \) \
            | sed 's|^\./||'
    fi
}

TOTAL_CHECKS=5
if [ "$RUN_TESTS" != "true" ]; then
    TOTAL_CHECKS=4
fi

echo -e "${CYAN}==> 运行代码质量门禁 (${TOTAL_CHECKS} 项检查)${NC}"
echo ""

exit_code=0
check_num=0

# ============================================================
# 1. JS 语法检查
# ============================================================
check_num=$((check_num + 1))
echo "  [${check_num}/${TOTAL_CHECKS}] 检查 JS 语法..."
syntax_errors=""
js_count=0

while IFS= read -r file; do
    if is_js_file "$file" && should_check_file "$file"; then
        js_count=$((js_count + 1))
        if ! node --check "$file" 2>&1; then
            syntax_errors="${syntax_errors}  - ${file}"$'\n'
        fi
    fi
done < <(collect_files)

if [ -n "$syntax_errors" ]; then
    echo -e "${RED}  ✗ 发现语法错误：${NC}"
    echo "$syntax_errors"
    exit_code=1
else
    echo -e "${GREEN}  ✓ ${js_count} 个 JS 文件语法正确${NC}"
fi

# ============================================================
# 2. 行尾空格检查
# ============================================================
check_num=$((check_num + 1))
echo ""
echo "  [${check_num}/${TOTAL_CHECKS}] 检查行尾空格..."
whitespace_files=""

while IFS= read -r file; do
    if is_text_file "$file" && should_check_file "$file"; then
        if grep -q ' $' "$file" 2>/dev/null; then
            count=$(grep -c ' $' "$file" 2>/dev/null || echo 0)
            whitespace_files="${whitespace_files}  - ${file} (${count} 处)"$'\n'
        fi
    fi
done < <(collect_files)

if [ -n "$whitespace_files" ]; then
    echo -e "${RED}  ✗ 发现行尾空格：${NC}"
    echo "$whitespace_files"
    echo -e "${YELLOW}  自动修复：${NC}"
    echo -e "    ${YELLOW}find . -type f \\( -name '*.js' -o -name '*.html' -o -name '*.css' -o -name '*.json' -o -name '*.sh' \\) | xargs sed -i '' 's/[[:space:]]*$//'${NC}"
    exit_code=1
else
    echo -e "${GREEN}  ✓ 无行尾空格${NC}"
fi

# ============================================================
# 3. 合并冲突标记检查
# ============================================================
check_num=$((check_num + 1))
echo ""
echo "  [${check_num}/${TOTAL_CHECKS}] 检查合并冲突标记..."
conflict_files=""

while IFS= read -r file; do
    if is_text_file "$file" && should_check_file "$file"; then
        if grep -qE '^(<<<<<<< |=======$|>>>>>>> )' "$file" 2>/dev/null; then
            conflict_files="${conflict_files}  - ${file}"$'\n'
        fi
    fi
done < <(collect_files)

if [ -n "$conflict_files" ]; then
    echo -e "${RED}  ✗ 发现合并冲突标记：${NC}"
    echo "$conflict_files"
    exit_code=1
else
    echo -e "${GREEN}  ✓ 无冲突标记${NC}"
fi

# ============================================================
# 4. 脚本可执行权限检查
# ============================================================
check_num=$((check_num + 1))
echo ""
echo "  [${check_num}/${TOTAL_CHECKS}] 检查脚本可执行权限..."
permission_files=""

while IFS= read -r file; do
    if is_shell_script "$file" && should_check_file "$file"; then
        if [ ! -x "$file" ]; then
            permission_files="${permission_files}  - ${file}"$'\n'
        fi
    fi
done < <(collect_files)

if [ -n "$permission_files" ]; then
    echo -e "${YELLOW}  ⚠ 以下脚本缺少可执行权限：${NC}"
    echo "$permission_files"
    echo -e "${YELLOW}  自动修复：${NC}"
    echo -e "    ${YELLOW}chmod +x ${permission_files//  - /}${NC}"
    exit_code=1
else
    echo -e "${GREEN}  ✓ 所有脚本都有可执行权限${NC}"
fi

# ============================================================
# 5. 单元测试
# ============================================================
if [ "$RUN_TESTS" = "true" ]; then
    check_num=$((check_num + 1))
    echo ""
    echo "  [${check_num}/${TOTAL_CHECKS}] 运行单元测试..."

    if [ -f "tests/run-tests.js" ]; then
        if ! node tests/run-tests.js 2>&1; then
            echo ""
            echo -e "${RED}  ✗ 测试未通过${NC}"
            exit_code=1
        else
            echo ""
            echo -e "${GREEN}  ✓ 全部测试通过${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ 未找到测试文件，跳过测试${NC}"
    fi
fi

# ============================================================
# 结果汇总
# ============================================================
echo ""
if [ $exit_code -ne 0 ]; then
    echo -e "${RED}=================================${NC}"
    echo -e "${RED}  检查未通过 ✗${NC}"
    echo -e "${RED}=================================${NC}"
    echo ""
    echo "  请修复上述问题后再提交。"
    echo "  如需临时跳过检查（不推荐），可使用："
    echo "    git commit --no-verify"
    echo ""
    exit 1
else
    echo -e "${GREEN}=================================${NC}"
    echo -e "${GREEN}  全部检查通过 ✓${NC}"
    echo -e "${GREEN}=================================${NC}"
    echo ""
    exit 0
fi
