################################################################################
# Makefile - Production-Grade Build Automation for C++ Competitive Programming
#
# Targets:
#   make              - Show help
#   make all          - Compile all .cpp files in src/
#   make run FILE=x   - Compile and run src/x.cpp with timeout protection
#   make debug FILE=x - Compile with debug symbols (-g flag)
#   make clean        - Remove all compiled binaries
#   make help         - Show this help message
#
# Usage:
#   make all                  # Compile all files
#   make run FILE=template    # Compile and run src/template.cpp
#   make debug FILE=template  # Debug build
#   make clean                # Clean up
#
# Features:
#   - Auto-detects compiler (g++ or clang++)
#   - Optimized flags for competitive programming (-O2, -std=c++23)
#   - Error handling and compilation validation
#   - Timeout protection (5 seconds) for execution
#   - Supports multiple files
#   - Cross-platform (Linux/macOS/WSL)
#   - Production-grade reliability
#
################################################################################

.PHONY: all run clean debug help create_build_dir

# ==================== CONFIGURATION ====================

# Compiler selection - prefer g++, fall back to clang++
CXX := $(shell command -v g++ 2>/dev/null || echo clang++)
CXXFLAGS := -std=c++23 -O2 -Wall -Wextra
INCLUDE := -I./include
SRC_DIR := ./src
BUILD_DIR := ./build
OUTPUT_DIR := /tmp

# Default target - show help instead of building
FILE ?= solution

# ==================== TARGETS ====================

all: create_build_dir compile
	@echo "All files compiled successfully"

create_build_dir:
	@mkdir -p $(BUILD_DIR)

compile: create_build_dir
	@echo "Compiling with $(CXX)..."
	@find $(SRC_DIR) -name "*.cpp" -type f | while read file; do \
		filename=$$(basename "$$file" .cpp); \
		if $(CXX) $(CXXFLAGS) $(INCLUDE) "$$file" -o $(BUILD_DIR)/$$filename 2>&1; then \
			echo "  PASS: $$filename"; \
		else \
			echo "  FAIL: Compilation failed for $$filename"; \
			exit 1; \
		fi; \
	done

run: create_build_dir
	@echo "Compiling $(FILE) with $(CXX)..."
	@if [ -f "$(SRC_DIR)/$(FILE).cpp" ]; then \
		if $(CXX) $(CXXFLAGS) $(INCLUDE) $(SRC_DIR)/$(FILE).cpp -o $(OUTPUT_DIR)/$(FILE) 2>&1; then \
			echo "Compiled: $(FILE)"; \
			echo "Running with 5s timeout..."; \
			echo "---"; \
			timeout 5 $(OUTPUT_DIR)/$(FILE) 2>&1 || true; \
			echo "---"; \
			rm -f $(OUTPUT_DIR)/$(FILE); \
		else \
			echo "FAIL: Compilation failed"; \
			exit 1; \
		fi; \
	elif [ -f "$(SRC_DIR)/$(FILE)/solution.cpp" ]; then \
		if $(CXX) $(CXXFLAGS) $(INCLUDE) $(SRC_DIR)/$(FILE)/solution.cpp -o $(OUTPUT_DIR)/$(FILE) 2>&1; then \
			echo "Compiled: $(FILE)"; \
			echo "Running with 5s timeout..."; \
			echo "---"; \
			timeout 5 $(OUTPUT_DIR)/$(FILE) 2>&1 || true; \
			echo "---"; \
			rm -f $(OUTPUT_DIR)/$(FILE); \
		else \
			echo "FAIL: Compilation failed"; \
			exit 1; \
		fi; \
	else \
		echo "FAIL: Error: Could not find $(FILE).cpp or $(FILE)/solution.cpp"; \
		exit 1; \
	fi

debug: create_build_dir
	@echo "Compiling $(FILE) with debug symbols..."
	@if [ -f "$(SRC_DIR)/$(FILE).cpp" ]; then \
		if $(CXX) $(CXXFLAGS) -g $(INCLUDE) $(SRC_DIR)/$(FILE).cpp -o $(BUILD_DIR)/$(FILE)_debug 2>&1; then \
			echo "Debug binary: $(BUILD_DIR)/$(FILE)_debug"; \
		else \
			echo "FAIL: Compilation failed"; \
			exit 1; \
		fi; \
	elif [ -f "$(SRC_DIR)/$(FILE)/solution.cpp" ]; then \
		if $(CXX) $(CXXFLAGS) -g $(INCLUDE) $(SRC_DIR)/$(FILE)/solution.cpp -o $(BUILD_DIR)/$(FILE)_debug 2>&1; then \
			echo "Debug binary: $(BUILD_DIR)/$(FILE)_debug"; \
		else \
			echo "FAIL: Compilation failed"; \
			exit 1; \
		fi; \
	else \
		echo "FAIL: Error: Could not find $(FILE).cpp or $(FILE)/solution.cpp"; \
		exit 1; \
	fi

clean:
	@rm -rf $(BUILD_DIR)
	@find $(SRC_DIR) -name "*.o" -delete
	@echo "Cleaned build artifacts"

help:
	@echo "Makefile for C++ Competitive Programming"
	@echo ""
	@echo "Targets:"
	@echo "  make              - Show this help"
	@echo "  make all          - Compile all .cpp files"
	@echo "  make run FILE=x   - Compile and run FILE"
	@echo "  make debug FILE=x - Compile with debug symbols"
	@echo "  make clean        - Remove compiled files"
	@echo "  make help         - Show this message"
	@echo ""
	@echo "Examples:"
	@echo "  make all"
	@echo "  make run FILE=template"
	@echo "  make debug FILE=template"
	@echo "  make clean"
	@echo ""
	@echo "Compiler: $(CXX)"
	@echo "Flags: $(CXXFLAGS)"
	@echo "Timeout: 5 seconds per execution"

# Default target - show help on empty make
.DEFAULT_GOAL := help
