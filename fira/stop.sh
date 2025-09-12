#!/bin/bash

# Fira Project Management Server
# Stop script for macOS and Linux

echo "Checking for Fira servers..."

FOUND_SERVERS=0

# Find and kill Python processes running server.py or mini-server.py
echo "Checking for Fira server processes..."
SERVER_PIDS=$(pgrep -f "python.*(server\.py|mini-server\.py)")

if [ ! -z "$SERVER_PIDS" ]; then
    echo "Found server processes: $SERVER_PIDS"
    FOUND_SERVERS=1
    
    # Kill the processes
    for PID in $SERVER_PIDS; do
        echo "Stopping process $PID..."
        kill $PID
        sleep 1
        
        # Check if process is still running and force kill if needed
        if ps -p $PID > /dev/null 2>&1; then
            echo "Force stopping process $PID..."
            kill -9 $PID
        fi
    done
fi

# Check processes using Fira ports
echo "Checking processes on Fira ports..."

# Port 5000 (Flask API)
PORT_5000_PID=$(lsof -ti:5000 2>/dev/null)
if [ ! -z "$PORT_5000_PID" ]; then
    echo "Stopping process using port 5000: $PORT_5000_PID"
    kill $PORT_5000_PID
    sleep 1
    
    if ps -p $PORT_5000_PID > /dev/null 2>&1; then
        kill -9 $PORT_5000_PID
    fi
    FOUND_SERVERS=1
fi

# Port 8080 (HTTP server)
PORT_8080_PID=$(lsof -ti:8080 2>/dev/null)
if [ ! -z "$PORT_8080_PID" ]; then
    echo "Stopping process using port 8080: $PORT_8080_PID"
    kill $PORT_8080_PID
    sleep 1
    
    if ps -p $PORT_8080_PID > /dev/null 2>&1; then
        kill -9 $PORT_8080_PID
    fi
    FOUND_SERVERS=1
fi

# Port 8081 (Alternative HTTP server)
PORT_8081_PID=$(lsof -ti:8081 2>/dev/null)
if [ ! -z "$PORT_8081_PID" ]; then
    echo "Stopping process using port 8081: $PORT_8081_PID"
    kill $PORT_8081_PID
    sleep 1
    
    if ps -p $PORT_8081_PID > /dev/null 2>&1; then
        kill -9 $PORT_8081_PID
    fi
    FOUND_SERVERS=1
fi

echo ""
if [ "$FOUND_SERVERS" = "1" ]; then
    echo "Fira servers stopped successfully!"
else
    echo "No Fira servers were running."
fi
echo "All done!"