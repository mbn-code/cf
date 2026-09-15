################################################################################
# Makefile - Portable build automation for the cf competitive-programming kit
#
# Targets:
#   make                 - Show this help
#   make all             - Compile every .cpp under src/ into build/
#   make build FILE=x    - Compile one source (no run)
#   make run FILE=x      - Compile and run, with a portable timeout + timing
#   make test FILE=x     - Compile and run against src/x/input.txt, diff expected
#   make debug FILE=x    - Compile with debug symbols (-g)
#   make check           - Shellcheck + CLI tests + web lint/typecheck/unit/build
#   make check-quick     - Same without the production build
#   make web-install     - npm install in web/
#   make web-dev         - Start the workbench dev server
#   make web-build       - Production build of the workbench
#   make web-test        - Unit tests (vitest)
#   make web-e2e         - Playwright end-to-end suite
#   make validate        - Full release gate (scripts/validate.sh)
#   make clean           - Remove build artifacts
#   make help            - Show this help
#
# FILE resolves (in order) to:
#   src/<FILE>.cpp  |  src/<FILE>/solution.cpp  |  <FILE> (a literal path)
#
# Knobs (override on the command line):
#   make run FILE=x TL=2           # 2 second time limit
#   make all CXXSTD=gnu++20         # different C++ standard
#
# Portability:
#   - Compiler auto-detect prefers clang++/c++ (macOS default) then g++.
#   - Same `-I include` flag the web engine uses, so <bits/stdc++.h> resolves.
#   - Timing/timeout use Node when available (high-resolution, cross-platform)
#     and fall back to a pure-POSIX background+kill timer. The GNU `timeout`
#     command and the shell `time` builtin are intentionally avoided so this
#     works on macOS (bash 3.2 / zsh) without coreutils.
################################################################################

.PHONY: all build run test debug clean help check check-quick web-install web-dev web-build web-test web-e2e validate

# ==================== Configuration ====================

# Prefer clang++/c++ (macOS), then g++. Override with `make CXX=...`.
CXX     ?= $(shell command -v clang++ 2>/dev/null || command -v c++ 2>/dev/null || command -v g++ 2>/dev/null || echo c++)
NODE    := $(shell command -v node 2>/dev/null)
CXXSTD  ?= gnu++17
CXXFLAGS ?= -std=$(CXXSTD) -O2 -Wall -Wextra
INCLUDE := -I include
SRC_DIR := src
BUILD_DIR := build
WEB_DIR := web
FILE    ?= solution
TL      ?= 5

.DEFAULT_GOAL := help

# Resolve FILE to a source path (shared by build/run/test/debug).
define resolve_src
	src=""; \
	if [ -f "$(SRC_DIR)/$(FILE).cpp" ]; then src="$(SRC_DIR)/$(FILE).cpp"; \
	elif [ -f "$(SRC_DIR)/$(FILE)/solution.cpp" ]; then src="$(SRC_DIR)/$(FILE)/solution.cpp"; \
	elif [ -f "$(FILE)" ]; then src="$(FILE)"; fi; \
	if [ -z "$$src" ]; then echo "error: cannot find source for FILE=$(FILE)"; exit 1; fi
endef

# ==================== C++ targets ====================

all:
	@mkdir -p $(BUILD_DIR); \
	echo "Compiling all sources in $(SRC_DIR)/ with $(CXX) ..."; \
	rc=0; \
	find $(SRC_DIR) -name '*.cpp' -type f | while IFS= read -r file; do \
		name=`basename "$$file" .cpp`; \
		if out=`$(CXX) $(CXXFLAGS) $(INCLUDE) "$$file" -o "$(BUILD_DIR)/$$name" 2>&1`; then \
			echo "  PASS: $$name"; \
		else \
			echo "  FAIL: $$name"; echo "$$out"; rc=1; \
		fi; \
	done; \
	exit $$rc

build:
	@mkdir -p $(BUILD_DIR); \
	$(resolve_src); \
	out="$(BUILD_DIR)/$(FILE)"; mkdir -p "`dirname "$$out"`"; \
	echo "Compiling $$src -> $$out with $(CXX) ..."; \
	$(CXX) $(CXXFLAGS) $(INCLUDE) "$$src" -o "$$out" && echo "OK: $$out"

run:
	@mkdir -p $(BUILD_DIR); \
	$(resolve_src); \
	bin="$(BUILD_DIR)/cf_run_bin"; \
	echo "Compiling $$src with $(CXX) ..."; \
	if ! $(CXX) $(CXXFLAGS) $(INCLUDE) "$$src" -o "$$bin"; then echo "compile failed"; exit 1; fi; \
	echo "Running (timeout $(TL)s) ..."; echo "---"; \
	if [ -n "$(NODE)" ]; then \
		'$(NODE)' -e 'const{spawn}=require("child_process");const b=process.argv[1];const tl=(+process.argv[2]||5)*1000;const t=process.hrtime.bigint();const c=spawn(b,{stdio:"inherit"});const k=setTimeout(()=>{c.kill("SIGKILL");process.stderr.write("\n[timeout after "+(tl/1000)+"s]\n");},tl);c.on("close",(code,sig)=>{clearTimeout(k);const ms=Number(process.hrtime.bigint()-t)/1e6;process.stderr.write("\n[elapsed "+ms.toFixed(1)+" ms; exit "+(code===null?sig:code)+"]\n");process.exit(typeof code==="number"?code:137);});' "$$bin" "$(TL)"; \
		status=$$?; \
	else \
		s=`date +%s`; \
		"$$bin" & rpid=$$!; \
		( sleep $(TL); kill -9 $$rpid 2>/dev/null ) & wpid=$$!; \
		wait $$rpid 2>/dev/null; status=$$?; \
		kill $$wpid 2>/dev/null; wait $$wpid 2>/dev/null; \
		e=`date +%s`; \
		echo "[elapsed $$((e - s))s; exit $$status]"; \
	fi; \
	echo "---"; \
	rm -f "$$bin"; \
	exit $$status

test:
	@mkdir -p $(BUILD_DIR); \
	$(resolve_src); \
	bin="$(BUILD_DIR)/cf_test_bin"; \
	echo "Compiling $$src with $(CXX) ..."; \
	if ! $(CXX) $(CXXFLAGS) $(INCLUDE) "$$src" -o "$$bin"; then echo "compile failed"; exit 1; fi; \
	inp="$(SRC_DIR)/$(FILE)/input.txt"; exp="$(SRC_DIR)/$(FILE)/expected.txt"; \
	if [ ! -f "$$inp" ]; then echo "No $$inp found; compile OK."; rm -f "$$bin"; exit 0; fi; \
	out=`mktemp 2>/dev/null || echo "$(BUILD_DIR)/cf_test_out"`; \
	s=`date +%s`; \
	"$$bin" < "$$inp" > "$$out" 2>/dev/null & rpid=$$!; \
	( sleep $(TL); kill -9 $$rpid 2>/dev/null ) & wpid=$$!; \
	wait $$rpid 2>/dev/null; status=$$?; \
	kill $$wpid 2>/dev/null; wait $$wpid 2>/dev/null; \
	e=`date +%s`; \
	echo "[elapsed $$((e - s))s; exit $$status]"; \
	if [ -f "$$exp" ]; then \
		sed -e 's/[[:space:]]*$$//' "$$exp" > "$$out.e"; \
		sed -e 's/[[:space:]]*$$//' "$$out" > "$$out.a"; \
		if diff -q "$$out.e" "$$out.a" >/dev/null 2>&1; then echo "AC"; \
		else echo "WA"; echo "--- expected ---"; cat "$$exp"; echo "--- actual ---"; cat "$$out"; fi; \
		rm -f "$$out.e" "$$out.a"; \
	else echo "--- output ---"; cat "$$out"; fi; \
	rm -f "$$out" "$$bin"

debug:
	@mkdir -p $(BUILD_DIR); \
	$(resolve_src); \
	out="$(BUILD_DIR)/$(FILE)_debug"; mkdir -p "`dirname "$$out"`"; \
	echo "Compiling $$src with debug symbols ..."; \
	$(CXX) $(CXXFLAGS) -g $(INCLUDE) "$$src" -o "$$out" && echo "Debug binary: $$out"

clean:
	@rm -rf $(BUILD_DIR); \
	find $(SRC_DIR) -name '*.o' -delete 2>/dev/null || true; \
	echo "Cleaned build artifacts"

# ==================== Quality gates ====================

check:
	@bash scripts/check.sh

check-quick:
	@bash scripts/check.sh --quick

validate:
	@bash scripts/validate.sh

# ==================== Web workbench ====================

web-install:
	@cd $(WEB_DIR) && npm install --include=dev --no-audit --no-fund

web-dev:
	@cd $(WEB_DIR) && npm run dev

web-build:
	@cd $(WEB_DIR) && npm run build

web-test:
	@cd $(WEB_DIR) && npm test

web-e2e:
	@cd $(WEB_DIR) && npx playwright install chromium && npm run e2e

help:
	@echo "cf Makefile - portable C++ build/run/test"; \
	echo ""; \
	echo "C++ targets:"; \
	echo "  make all            Compile every src/**/*.cpp into build/"; \
	echo "  make build FILE=x   Compile one source"; \
	echo "  make run FILE=x     Compile and run (timeout $(TL)s, timed)"; \
	echo "  make test FILE=x    Compile and run vs src/x/input.txt"; \
	echo "  make debug FILE=x   Compile with -g"; \
	echo "  make clean          Remove build artifacts"; \
	echo ""; \
	echo "Quality gates:"; \
	echo "  make check          shellcheck + CLI tests + web lint/typecheck/unit/build"; \
	echo "  make check-quick    Same, without the production build"; \
	echo "  make validate       Full release gate incl. Playwright e2e"; \
	echo ""; \
	echo "Web workbench:"; \
	echo "  make web-install | web-dev | web-build | web-test | web-e2e"; \
	echo ""; \
	echo "Knobs: FILE, TL (time limit s), CXXSTD, CXXFLAGS, CXX"; \
	echo "Compiler: $(CXX)"; \
	echo "Flags:    $(CXXFLAGS) $(INCLUDE)"; \
	echo "Node:     $(if $(NODE),$(NODE),not found (POSIX fallback timer))"
