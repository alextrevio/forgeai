#!/bin/bash
set -e

echo "ForgeAI Sandbox starting..."
echo "Project ID: ${PROJECT_ID:-unknown}"
echo "Framework: ${FRAMEWORK:-react-vite}"

# Keep the container running and ready for commands
# The sandbox manager will execute commands via docker exec
echo "Sandbox ready. Waiting for commands..."

# Keep alive
tail -f /dev/null
