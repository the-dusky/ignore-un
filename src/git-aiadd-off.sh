#!/bin/bash

# Function to merge ai.gitignore into .gitignore
merge_ai_gitignore() {
    local dir="$1"
    cd "$dir" || return
    
    if [ ! -f "ai.gitignore" ]; then
        return
    fi
    
    # Create backup of .gitignore
    if [ -f ".gitignore" ]; then
        cp .gitignore .gitignore.bak
    fi
    
    # Add AI section to .gitignore
    {
        if [ -f ".gitignore" ]; then
            grep -v "^ai\.gitignore$" .gitignore
        fi
        echo ""
        echo "# --- AI Development Section ---"
        cat ai.gitignore
        echo "# --- End AI Development Section ---"
    } > .gitignore.temp
    
    mv .gitignore.temp .gitignore
    rm -f ai.gitignore
}

# Get current directory and repo root
CURRENT_DIR=$(pwd)
REPO_ROOT=$(git rev-parse --show-toplevel)

# Find all ai.gitignore files
find "$CURRENT_DIR" -name "ai.gitignore" -type f | while read -r aigitignore; do
    dir=$(dirname "$aigitignore")
    echo "Processing $aigitignore"
    merge_ai_gitignore "$dir"
done

# Stage changes
git add -u
