#!/bin/bash

# Function to ensure gitignore files exist
ensure_gitignore_files() {
    local dir="$1"
    cd "$dir" || return
    
    # Create .gitignore if it doesn't exist
    if [ ! -f ".gitignore" ]; then
        echo "# AI gitignore file
ai.gitignore

# Project-specific ignores
.env
.env.local" > .gitignore
    else
        # Ensure ai.gitignore is listed
        if ! grep -q "ai.gitignore" ".gitignore"; then
            # Add at the top of the file
            temp=$(mktemp)
            echo "# AI gitignore file
ai.gitignore

$(cat .gitignore)" > "$temp"
            mv "$temp" .gitignore
        fi
    fi
    
    # Create ai.gitignore if it doesn't exist
    if [ ! -f "ai.gitignore" ]; then
        echo "# Temporary files
temp.gitignore

# AI-specific ignores" > ai.gitignore
    fi
}

# Function to add new gitignore files to git
add_new_gitignores() {
    local dir="$1"
    cd "$dir" || return
    
    # Find all .gitignore files that aren't tracked
    git ls-files --others --exclude-standard | grep '\.gitignore$' | while read -r file; do
        echo "Adding new .gitignore: $file"
        git add "$file"
    done
}

# Function to ensure ai.gitignore is properly ignored
ensure_ai_gitignore_ignored() {
    local dir="$1"
    cd "$dir" || return
    
    # Check if ai.gitignore is properly ignored
    if git check-ignore -q "ai.gitignore"; then
        return 0
    fi
    
    echo "Fixing ai.gitignore ignore rule in $dir"
    # Add to top of .gitignore if needed
    if [ -f ".gitignore" ]; then
        if ! grep -q "^ai\.gitignore$" ".gitignore"; then
            temp=$(mktemp)
            echo "# AI gitignore file
ai.gitignore

$(cat .gitignore)" > "$temp"
            mv "$temp" .gitignore
            git add .gitignore
        fi
    else
        echo "# AI gitignore file
ai.gitignore" > .gitignore
        git add .gitignore
    fi
}

# Function to commit gitignore changes
commit_gitignore_changes() {
    local dir="$1"
    cd "$dir" || return
    
    # Check if there are any gitignore changes
    if git status --porcelain | grep -q "\.gitignore"; then
        echo "Committing .gitignore changes in $dir"
        git commit -m "Update .gitignore files to ignore ai.gitignore" .gitignore */.gitignore
    fi
}

# Get the current directory
CURRENT_DIR=$(pwd)

# Get the git repository root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Find workspaces only under current directory
WORKSPACE_DIRS=$(
    {
        # Always include current directory if it's a workspace
        if [ -f "$CURRENT_DIR/package.json" ]; then
            echo "$CURRENT_DIR"
        fi
        # Find workspaces under current directory
        find "$CURRENT_DIR" -name "package.json" -type f -exec dirname {} \;
    } | sort -u
)

# If no workspaces found, just use current directory
if [ -z "$WORKSPACE_DIRS" ]; then
    WORKSPACE_DIRS="$CURRENT_DIR"
fi

# First ensure all gitignore files exist and ai.gitignore is properly ignored
for dir in $WORKSPACE_DIRS; do
    ensure_gitignore_files "$dir"
    ensure_ai_gitignore_ignored "$dir"
done

# Then add any new .gitignore files
for dir in $WORKSPACE_DIRS; do
    add_new_gitignores "$dir"
done

# Commit any .gitignore changes before proceeding
cd "$REPO_ROOT" || exit 1
commit_gitignore_changes "$REPO_ROOT"

# Process all gitignore files
for dir in $WORKSPACE_DIRS; do
    handle_gitignore "$dir"
done

# Force git to re-read gitignore patterns
cd "$REPO_ROOT" || exit 1
git add -A  # Stage all changes first
git reset   # Unstage everything
git add .   # Re-add with new ignore patterns in effect

# Restore all gitignore files
for dir in $WORKSPACE_DIRS; do
    restore_gitignore "$dir"
done

# Return to original directory
cd "$CURRENT_DIR" || exit 1
