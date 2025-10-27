#!/bin/bash

# Script to generate changelog using git-cliff
# Usage: ./generate-changelog.sh [tag]
# If tag is not provided, generates changelog for all unreleased commits

set -e

# Check if git-cliff is installed
if ! command -v git-cliff &> /dev/null; then
    echo "Error: git-cliff is not installed"
    echo ""
    echo "Install git-cliff using one of the following methods:"
    echo ""
    echo "1. Using cargo (Rust):"
    echo "   cargo install git-cliff"
    echo ""
    echo "2. Using pre-built binaries:"
    echo "   Visit: https://github.com/orhun/git-cliff/releases"
    echo ""
    echo "3. Using package managers:"
    echo "   - Arch Linux: pacman -S git-cliff"
    echo "   - Homebrew: brew install git-cliff"
    echo "   - Nix: nix-env -iA nixpkgs.git-cliff"
    echo ""
    exit 1
fi

# Check if cliff.toml exists
if [ ! -f "cliff.toml" ]; then
    echo "Error: cliff.toml configuration file not found"
    exit 1
fi

echo "Generating changelog..."

if [ -z "$1" ]; then
    # Generate unreleased changelog
    echo "Generating unreleased changes..."
    git-cliff --unreleased --tag unreleased -o CHANGELOG.md
else
    # Generate changelog up to specified tag
    echo "Generating changelog up to tag: $1"
    git-cliff --tag "$1" -o CHANGELOG.md
fi

echo "Changelog generated successfully: CHANGELOG.md"
