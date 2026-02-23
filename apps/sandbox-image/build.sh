#!/bin/bash
set -e

echo "Building ForgeAI sandbox image..."
docker build -t forgeai/sandbox:latest .
echo "Done! Image: forgeai/sandbox:latest"
