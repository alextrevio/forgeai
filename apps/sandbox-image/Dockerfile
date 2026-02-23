FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Base tools
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Global npm tools
RUN npm install -g pnpm vite create-vite typescript tsx

# Create non-root user
RUN useradd -m -s /bin/bash -u 1000 sandbox
RUN mkdir -p /workspace && chown sandbox:sandbox /workspace

# Working directory
WORKDIR /workspace

# Dev server port
EXPOSE 5173
# Additional ports
EXPOSE 3000 8080

# Switch to non-root user
USER sandbox

# Entrypoint
COPY --chown=sandbox:sandbox entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
