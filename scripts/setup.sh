#!/bin/bash

################################################################################
# setup.sh - Cross-platform C++ Competitive Programming Environment Setup
#
# This script automatically:
# - Detects OS (Linux/macOS/WSL)
# - Installs g++ 14.x, clang++, make, and debugging tools
# - Configures the 'cf' command globally
# - Installs Neovim and VS Code extensions when available
#
# Usage: bash scripts/setup.sh
# Safe to run multiple times (idempotent)
################################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # No Color

# Automatic editor setup (can be disabled with CF_SETUP_EDITORS=0)
CF_SETUP_EDITORS=${CF_SETUP_EDITORS:-1}

# ==================== HELPER FUNCTIONS ====================

print_header() {
    echo -e "${BLUE}═════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}PASS: $1${NC}"
}

print_info() {
    echo -e "${BLUE}INFO: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}WARN: $1${NC}"
}

print_error() {
    echo -e "${RED}FAIL: $1${NC}"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get OS type
# Returns: macos | debian | fedora | redhat | linux
# WSL is treated as linux
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
        return
    fi

    if [[ -f /etc/os-release ]]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        case "${ID:-}" in
            ubuntu|debian|linuxmint)
                echo "debian"
                return
                ;;
            fedora)
                echo "fedora"
                return
                ;;
            rhel|centos|rocky|almalinux)
                echo "redhat"
                return
                ;;
        esac
    fi

    echo "linux"
}

# ==================== DEBIAN/UBUNTU SETUP ====================

setup_debian() {
    print_header "Setting up C++ environment on Debian/Ubuntu"

    print_info "Updating package manager..."
    sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq 2>/dev/null || true

    # Base tools
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
        build-essential gdb clang make cmake pkg-config curl ca-certificates 2>/dev/null || true

    # Install g++ 14 if available
    if sudo apt-cache search g++.*14 2>/dev/null | grep -q "^g++-14 "; then
        print_info "Installing g++ 14..."
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y g++-14 2>/dev/null || true
        sudo update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-14 100 2>/dev/null || true
        sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-14 100 2>/dev/null || true
        print_success "g++ 14 configured"
    fi

    print_success "Debian/Ubuntu toolchain setup complete"
}

# ==================== FEDORA/REDHAT SETUP ====================

setup_fedora() {
    print_header "Setting up C++ environment on Fedora/RHEL"

    print_info "Updating package manager..."
    sudo dnf check-update -q 2>/dev/null || true

    sudo dnf install -y \
        gcc-c++ clang make gdb cmake pkgconf-pkg-config curl ca-certificates 2>/dev/null || true

    print_info "Installing Development Tools group..."
    sudo dnf groupinstall -y "Development Tools" 2>/dev/null || true

    print_success "Fedora/RHEL toolchain setup complete"
}

setup_redhat() {
    if command_exists dnf; then
        setup_fedora
        return
    fi

    print_header "Setting up C++ environment on RHEL/CentOS (yum)"
    sudo yum makecache -q 2>/dev/null || true
    sudo yum install -y \
        gcc-c++ clang make gdb cmake pkgconfig curl ca-certificates 2>/dev/null || true
    print_success "RHEL/CentOS toolchain setup complete"
}

# ==================== MACOS SETUP ====================

setup_macos() {
    print_header "Setting up C++ environment on macOS"

    if ! command_exists brew; then
        print_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        print_success "Homebrew installed"
    else
        print_success "Homebrew is already installed"
    fi

    if ! command_exists g++ || [[ $(g++ --version | head -1 | grep -oE '[0-9]+' | head -1) -lt 14 ]]; then
        print_info "Installing g++ 14..."
        brew install gcc@14 2>/dev/null || brew install gcc 2>/dev/null

        GCC_PATH=$(brew --prefix gcc@14 2>/dev/null || brew --prefix gcc)
        if [ -f "$GCC_PATH/bin/g++-14" ]; then
            sudo ln -sf "$GCC_PATH/bin/gcc-14" /usr/local/bin/gcc 2>/dev/null || true
            sudo ln -sf "$GCC_PATH/bin/g++-14" /usr/local/bin/g++ 2>/dev/null || true
        fi
        print_success "g++ installed"
    else
        print_success "g++ is already installed ($(g++ --version | head -1))"
    fi

    if ! command_exists clang++; then
        print_info "Installing Xcode Command Line Tools..."
        xcode-select --install 2>/dev/null || true
        print_success "Xcode Command Line Tools installed"
    else
        print_success "clang++ is already installed"
    fi

    if ! command_exists make; then
        print_info "Installing make..."
        brew install make 2>/dev/null
        print_success "make installed"
    else
        print_success "make is already installed"
    fi

    if ! command_exists lldb; then
        print_warning "lldb not found. Run: xcode-select --install"
    else
        print_success "lldb is already installed"
    fi

    if ! command_exists cmake; then
        print_info "Installing cmake..."
        brew install cmake 2>/dev/null
        print_success "cmake installed"
    else
        print_success "cmake is already installed"
    fi
}

# ==================== EDITOR SETUP ====================

setup_neovim() {
    if ! command_exists nvim; then
        print_info "Installing Neovim..."
        OS=$(detect_os)
        case "$OS" in
            debian)
                sudo DEBIAN_FRONTEND=noninteractive apt-get install -y neovim 2>/dev/null || true
                ;;
            fedora)
                sudo dnf install -y neovim 2>/dev/null || true
                ;;
            redhat)
                if command_exists dnf; then
                    sudo dnf install -y neovim 2>/dev/null || true
                else
                    sudo yum install -y neovim 2>/dev/null || true
                fi
                ;;
            macos)
                brew install neovim 2>/dev/null || true
                ;;
        esac
    fi

    if command_exists nvim; then
        NVIM_CONFIG="$HOME/.config/nvim/init.vim"
        if [ ! -f "$NVIM_CONFIG" ]; then
            mkdir -p "$HOME/.config/nvim"
            cat > "$NVIM_CONFIG" << 'EOF'
" Neovim C++ Configuration
set number
set expandtab
set tabstop=4
set shiftwidth=4
set autoindent

" Install vim-plug if not exists
if empty(glob('~/.config/nvim/autoload/plug.vim'))
  silent !curl -fLo ~/.config/nvim/autoload/plug.vim --create-dirs \
    https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
endif

call plug#begin()
Plug 'neoclide/coc.nvim', {'branch': 'release'}
Plug 'vim-airline/vim-airline'
Plug 'preservim/nerdtree'
call plug#end()
EOF
            print_success "Neovim config created"
        else
            print_success "Neovim config already exists"
        fi
    fi
}

setup_vscode() {
    if ! command_exists code; then
        print_warning "VS Code not found. Skipping VS Code extensions."
        return
    fi

    print_info "Installing C++ extensions for VS Code..."
    code --install-extension ms-vscode.cpptools 2>/dev/null || true
    code --install-extension ms-vscode.cpptools-extension-pack 2>/dev/null || true
    code --install-extension ms-vscode-remote.remote-wsl 2>/dev/null || true
    print_success "VS Code extensions installed"
}

# ==================== CF COMMAND SETUP ====================

setup_cf_command() {
    print_header "Configuring 'cf' command"

    CF_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cf"

    if [ ! -f "$CF_SCRIPT" ]; then
        print_error "cf script not found at $CF_SCRIPT"
        return 1
    fi

    chmod +x "$CF_SCRIPT"
    print_success "cf script is executable"

    for SHELL_RC in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [ -f "$SHELL_RC" ]; then
            if ! grep -q "# Added by cf setup" "$SHELL_RC"; then
                {
                    echo ""
                    echo "# Added by cf setup"
                    echo "export PATH=\"\$PATH:$(dirname "$CF_SCRIPT")\""
                } >> "$SHELL_RC"
                print_success "Added cf to $SHELL_RC"
            fi
        fi
    done

    if [ -w /usr/local/bin ] 2>/dev/null; then
        ln -sf "$CF_SCRIPT" /usr/local/bin/cf 2>/dev/null || true
        print_success "Created symlink /usr/local/bin/cf"
    elif command_exists sudo; then
        sudo ln -sf "$CF_SCRIPT" /usr/local/bin/cf 2>/dev/null || true
        print_success "Created symlink /usr/local/bin/cf (via sudo)"
    fi

    if [ -n "${BASH_VERSION:-}" ] && [ -f "$HOME/.bashrc" ]; then
        # shellcheck disable=SC1090
        source "$HOME/.bashrc" 2>/dev/null || true
        print_success "Activated cf command in current bash session"
    elif [ -n "${ZSH_VERSION:-}" ] && [ -f "$HOME/.zshrc" ]; then
        # shellcheck disable=SC1090
        source "$HOME/.zshrc" 2>/dev/null || true
        print_success "Activated cf command in current zsh session"
    fi
}

# ==================== VERIFICATION ====================

verify_installation() {
    print_header "Verifying installation"

    local failed=0

    if command_exists g++; then
        print_success "g++ $(g++ --version | head -1)"
    else
        print_error "g++ not found"
        ((failed++))
    fi

    if command_exists clang++; then
        print_success "clang++ $(clang++ --version | head -1)"
    else
        print_warning "clang++ not found (optional)"
    fi

    if command_exists make; then
        print_success "make is installed"
    else
        print_error "make not found"
        ((failed++))
    fi

    if command_exists gdb; then
        print_success "gdb is installed"
    else
        print_warning "gdb not found (optional)"
    fi

    if command_exists cf; then
        print_success "cf command is available"
    else
        print_warning "cf command not found in PATH"
        ((failed++))
    fi

    if [ $failed -eq 0 ]; then
        print_success "All required tools are installed!"
        return 0
    else
        print_error "$failed requirement(s) not met"
        return 1
    fi
}

# ==================== TEST COMPILATION ====================

test_compilation() {
    print_header "Testing compilation"

    TEST_FILE="/tmp/test_cf_$RANDOM.cpp"
    TEST_OUT="/tmp/test_cf_$RANDOM"

    cat > "$TEST_FILE" << 'EOF'
#include <iostream>
int main() {
    std::cout << "CF Setup Successful!" << std::endl;
    return 0;
}
EOF

    if g++ -std=c++23 -O2 "$TEST_FILE" -o "$TEST_OUT" 2>/dev/null; then
        OUTPUT=$("$TEST_OUT")
        if [[ $OUTPUT == "CF Setup Successful!" ]]; then
            print_success "Compilation test passed"
            rm -f "$TEST_FILE" "$TEST_OUT"
            return 0
        fi
    fi

    print_error "Compilation test failed"
    rm -f "$TEST_FILE" "$TEST_OUT"
    return 1
}

# ==================== MAIN EXECUTION ====================

setup_linux() {
    OS=$(detect_os)
    case "$OS" in
        debian)
            setup_debian
            ;;
        fedora)
            setup_fedora
            ;;
        redhat)
            setup_redhat
            ;;
        linux)
            print_warning "Could not detect specific Linux distribution"
            print_info "Attempting Debian/Ubuntu setup..."
            setup_debian 2>/dev/null || setup_fedora 2>/dev/null || setup_redhat 2>/dev/null || {
                print_error "Could not install packages. Please install manually: g++, clang++, make, gdb"
                exit 1
            }
            ;;
        *)
            print_error "Unsupported OS: $OSTYPE"
            print_info "Supported: Ubuntu/Debian, Fedora/RHEL, macOS"
            exit 1
            ;;
    esac
}

main() {
    clear
    print_header "C++ Competitive Programming Environment Setup"

    OS=$(detect_os)

    if [[ "$OS" == "macos" ]]; then
        setup_macos
    else
        setup_linux
    fi

    setup_cf_command

    if [[ "$CF_SETUP_EDITORS" == "1" ]]; then
        echo
        print_info "Installing editor tooling automatically"
        setup_neovim
        setup_vscode
    fi

    echo
    if verify_installation && test_compilation; then
        print_header "Setup Complete!"
        echo -e "${GREEN}Your C++ competitive programming environment is ready!${NC}"
        echo ""
        echo "The cf command is now active in this session and all future shells."
        echo ""
        echo "Quick start:"
        echo "  • Create template: cf template problem_name"
        echo "  • Solve problem: cf problem_name input.txt"
        echo "  • View help: cf"
        echo ""
        echo "Try it now:"
        echo "  cf template hello_world"
        echo ""
        echo "Happy coding!"
    else
        print_error "Setup completed with warnings. Please review above."
        exit 1
    fi
}

main
