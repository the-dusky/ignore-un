#!/bin/bash

# Function to extract AI section from .gitignore to ai.gitignore
extract_ai_section() {
    local dir="$1"
    cd "$dir" || return
    
    if [ ! -f ".gitignore" ]; then
        return
    fi
    
    # Extract section between markers
    awk '/^# --- AI Development Section ---$/,/^# --- End AI Development Section ---$/' .gitignore > ai.gitignore.temp
    
    # Remove the section markers
    sed -i '' '/^# --- AI Development Section ---$/d' ai.gitignore.temp
    sed -i '' '/^# --- End AI Development Section ---$/d' ai.gitignore.temp
    
    # Remove the section from .gitignore
    sed -i '' '/^# --- AI Development Section ---$/,/^# --- End AI Development Section ---$/d' .gitignore
    
    # Move temp file to ai.gitignore if it has content
    if [ -s ai.gitignore.temp ]; then
        mv ai.gitignore.temp ai.gitignore
    else
        rm ai.gitignore.temp
    fi
    
    # Add ai.gitignore to .gitignore if not already there
    if ! grep -q "^ai\.gitignore$" .gitignore; then
        echo "ai.gitignore" >> .gitignore
    fi
}

# Get current directory and repo root
CURRENT_DIR=$(pwd)
REPO_ROOT=$(git rev-parse --show-toplevel)

# Find all .gitignore files
find "$CURRENT_DIR" -name ".gitignore" -type f | while read -r gitignore; do
    dir=$(dirname "$gitignore")
    echo "Processing $gitignore"
    extract_ai_section "$dir"
done

# Stage changes
git add -u
