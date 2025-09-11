#!/bin/bash

# Fira Project Management Server
# Stop script for macOS and Linux

echo "🛑 Stopping Fira server..."

# Find and kill Python processes running server.py
PIDS=$(pgrep -f "python.*server.py")

if [ -z "$PIDS" ]; then
    echo "ℹ️  No Fira server processes found running"
else
    echo "🔍 Found server processes: $PIDS"
    
    # Kill the processes
    for PID in $PIDS; do
        echo "🔄 Stopping process $PID..."
        kill $PID
        sleep 1
        
        # Check if process is still running and force kill if needed
        if ps -p $PID > /dev/null 2>&1; then
            echo "🔨 Force stopping process $PID..."
            kill -9 $PID
        fi
    done
    
    echo "✅ Fira server stopped successfully"
fi

# Also check for Flask processes on port 5000
FLASK_PID=$(lsof -ti:5000 2>/dev/null)
if [ ! -z "$FLASK_PID" ]; then
    echo "🔄 Stopping process using port 5000: $FLASK_PID"
    kill $FLASK_PID
    sleep 1
    
    if ps -p $FLASK_PID > /dev/null 2>&1; then
        kill -9 $FLASK_PID
    fi
    echo "✅ Port 5000 freed"
fi

echo "🎉 All done!"