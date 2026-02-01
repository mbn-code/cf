################################################################################
# Makefile - Build automation for C++ Competitive Programming
#
# Targets:
#   make              - Compile all .cpp files in src/
#   make run FILE=x   - Compile and run src/x.cpp
#   make clean        - Remove all compiled binaries
#   make debug        - Compile with debug symbols (-g flag)
#   make help         - Show this help message
#
# Usage:
#   make                      # Compile all
#   make run FILE=solution    # Compile and run
#   make clean                # Clean
#
# Features:
#   - Auto-detects compiler (g++ or clang++)
#   - Optimized flags for competitive programming
#   - Supports multiple files
#   - Cross-platform (Linux/macOS/WSL)
#
################################################################################

.PHONY: all run clean debug help

# ==================== CONFIGURATION ====================

# Compiler selection
CXX := $(shell command -v g++ 2>/dev/null || echo clang++)
CXXFLAGS := -std=c++23 -O2 -Wall -Wextra
INCLUDE := -I./include
SRC_DIR := ./src
BUILD_DIR := ./build
OUTPUT_DIR := /tmp

# Default target
FILE ?= solution

# ==================== TARGETS ====================

all: create_build_dir compile
	@echo "✓ All files compiled"

create_build_dir:
	@mkdir -p $(BUILD_DIR)

compile: create_build_dir
	@echo "Compiling with $(CXX)..."
	@find $(SRC_DIR) -name "*.cpp" -type f | while read file; do \
		filename=$$(basename "$$file" .cpp); \
		$(CXX) $(CXXFLAGS) $(INCLUDE) "$$file" -o $(BUILD_DIR)/$$filename; \
		echo "  ✓ $$filename"; \
	done

run: create_build_dir
	@echo "Compiling $(FILE) with $(CXX)..."
	@if [ -f "$(SRC_DIR)/$(FILE).cpp" ]; then \
		$(CXX) $(CXXFLAGS) $(INCLUDE) $(SRC_DIR)/$(FILE).cpp -o $(OUTPUT_DIR)/$(FILE); \
		echo "✓ Compiled: $(FILE)"; \
		echo "Running..."; \
		echo "---"; \
		$(OUTPUT_DIR)/$(FILE); \
		echo "---"; \
		rm -f $(OUTPUT_DIR)/$(FILE); \
	elif [ -f "$(SRC_DIR)/$(FILE)/solution.cpp" ]; then \
		$(CXX) $(CXXFLAGS) $(INCLUDE) $(SRC_DIR)/$(FILE)/solution.cpp -o $(OUTPUT_DIR)/$(FILE); \
		echo "✓ Compiled: $(FILE)"; \
		echo "Running..."; \
		echo "---"; \
		$(OUTPUT_DIR)/$(FILE); \
		echo "---"; \
		rm -f $(OUTPUT_DIR)/$(FILE); \
	else \
		echo "Error: Could not find $(FILE).cpp"; \
		exit 1; \
	fi

debug: create_build_dir
	@echo "Compiling $(FILE) with debug symbols..."
	@if [ -f "$(SRC_DIR)/$(FILE).cpp" ]; then \
		$(CXX) $(CXXFLAGS) -g $(INCLUDE) $(SRC_DIR)/$(FILE).cpp -o $(BUILD_DIR)/$(FILE)_debug; \
		echo "✓ Debug binary: $(BUILD_DIR)/$(FILE)_debug"; \
	elif [ -f "$(SRC_DIR)/$(FILE)/solution.cpp" ]; then \
		$(CXX) $(CXXFLAGS) -g $(INCLUDE) $(SRC_DIR)/$(FILE)/solution.cpp -o $(BUILD_DIR)/$(FILE)_debug; \
		echo "✓ Debug binary: $(BUILD_DIR)/$(FILE)_debug"; \
	else \
		echo "Error: Could not find $(FILE).cpp"; \
		exit 1; \
	fi

clean:
	@rm -rf $(BUILD_DIR)
	@find $(SRC_DIR) -name "*.o" -delete
	@echo "✓ Cleaned"

help:
	@echo "Makefile for C++ Competitive Programming"
	@echo ""
	@echo "Targets:"
	@echo "  make              - Compile all .cpp files"
	@echo "  make run FILE=x   - Compile and run FILE"
	@echo "  make debug FILE=x - Compile with debug symbols"
	@echo "  make clean        - Remove compiled files"
	@echo "  make help         - Show this message"
	@echo ""
	@echo "Examples:"
	@echo "  make"
	@echo "  make run FILE=1000A"
	@echo "  make debug FILE=1000A"
	@echo ""
	@echo "Compiler: $(CXX)"
	@echo "Flags: $(CXXFLAGS)"

# Default help on empty make
.DEFAULT_GOAL := help
