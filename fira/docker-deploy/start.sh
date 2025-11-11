#!/bin/bash

echo "================================"
echo "  Fira Project Management Server"
echo "================================"
echo ""

# Function to detect Python command
detect_python() {
    if command -v python3 &> /dev/null; then
        echo "python3"
    elif command -v python &> /dev/null && python --version 2>&1 | grep -q "Python 3"; then
        echo "python"
    else
        return 1
    fi
}

# Check if Python is available
PYTHON_CMD=$(detect_python)
if [ $? -ne 0 ]; then
    echo "ERROR: Python is not installed or not in PATH"
    echo "Please install Python 3.7+ from https://python.org"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Using mini-server (no dependencies required)
echo "Using mini-server (no dependencies required)..."

# Create projects directory if it doesn't exist
mkdir -p projects

echo ""
echo "Starting Fira server..."
echo "Server will be available at: http://localhost:8080"
echo ""
echo "To stop the server, press Ctrl+C"
echo ""

# Open the site in the default browser (different commands for different systems)
if command -v xdg-open > /dev/null; then
    # Linux
    xdg-open http://localhost:8080 &
elif command -v open > /dev/null; then
    # macOS
    open http://localhost:8080 &
fi

# Start the mini-server (no dependencies required)
export FIRA_PORT=8080
sleep 2
$PYTHON_CMD mini-server.py

echo ""
echo "Server stopped."
echo ""
read -p "Press Enter to exit..."
