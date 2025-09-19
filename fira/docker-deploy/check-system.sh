#!/bin/bash

# System Check Script for Fira on macOS
# This script diagnoses common issues

echo "🔍============================"
echo "   Fira System Diagnostics"
echo "============================"
echo ""

# Check macOS version
echo "🍎 macOS Version:"
sw_vers
echo ""

# Check Python installations
echo "🐍 Python Installations:"
echo "----------------------------------------"

# Check different Python locations
for python_path in python3 python /usr/bin/python3 /usr/local/bin/python3 /opt/homebrew/bin/python3; do
    if command -v $python_path &> /dev/null; then
        echo "✅ Found: $python_path"
        echo "   Version: $($python_path --version 2>&1)"
        echo "   Location: $(which $python_path)"
        
        # Check if pip is available
        if $python_path -m pip --version &> /dev/null 2>&1; then
            echo "   pip: ✅ Available"
        else
            echo "   pip: ❌ Not available"
        fi
        echo ""
    fi
done

# Check if Homebrew is installed
echo "🍺 Homebrew:"
if command -v brew &> /dev/null; then
    echo "✅ Homebrew installed: $(brew --version | head -1)"
    echo "   Python packages:"
    brew list | grep python || echo "   No Python packages found"
else
    echo "❌ Homebrew not installed"
    echo "   Install: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
fi
echo ""

# Check Xcode Command Line Tools
echo "🔧 Xcode Command Line Tools:"
if xcode-select -p &> /dev/null; then
    echo "✅ Installed: $(xcode-select -p)"
else
    echo "❌ Not installed"
    echo "   Install: xcode-select --install"
fi
echo ""

# Check current directory and files
echo "📁 Current Directory Check:"
echo "Directory: $(pwd)"
echo "Files:"
ls -la | grep -E "\.(py|sh)$" || echo "No Python or shell files found"
echo ""

# Check network connectivity
echo "🌐 Network Check:"
if ping -c 1 google.com &> /dev/null; then
    echo "✅ Internet connection working"
else
    echo "❌ No internet connection"
fi
echo ""

# Check port 5000
echo "🔌 Port 5000 Check:"
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 5000 is in use:"
    lsof -i :5000
else
    echo "✅ Port 5000 is available"
fi
echo ""

# Recommendations
echo "💡 Recommendations:"
echo "----------------------------------------"

if ! command -v brew &> /dev/null; then
    echo "1. Install Homebrew for better Python management"
fi

if ! command -v python3 &> /dev/null; then
    echo "2. Install Python 3: brew install python3"
fi

echo "3. Use the macOS-specific script: ./start-macos.sh"
echo "4. If issues persist, use virtual environment approach"
echo ""

echo "🎯 Quick Fix Commands:"
echo "----------------------------------------"
echo "# Install Homebrew (if not installed):"
echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
echo ""
echo "# Install Python via Homebrew:"
echo "brew install python3"
echo ""
echo "# Install Xcode Command Line Tools:"
echo "xcode-select --install"
echo ""
echo "# Run macOS-specific server:"
echo "./start-macos.sh"
echo ""

echo "✅ System check complete!"