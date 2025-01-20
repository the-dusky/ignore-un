const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const minimatch = require('minimatch');

interface GitIgnoreState {
    aiPatterns: string[];
    regularContent: string[];
}

const AI_SECTION_START = '# --- AI Development Section ---'
const AI_SECTION_END = '# --- End AI Development Section ---'
const AI_MODE_MARKER = '.ai_mode'

const DEFAULT_PATTERNS: string[] = [
    '# Node',
    'node_modules',
    'npm-debug.log',
    
    '# Environment',
    '.env',
    '.env.local',
    
    '# IDE',
    '.idea',
    '.vscode',
    '*.swp',
    
    '# Build',
    'dist',
    'build',
    '*.tsbuildinfo'
]

const DEFAULT_GITIGNORE: string = `# AI gitignore file
ai.gitignore

# Project-specific ignores
.env
.env.local`

const DEFAULT_AI_GITIGNORE: string = `# AI Development Files
*.onnx
*.pt
*.pth
*.h5
*.hdf5
*.pb
*.tflite
*.mlmodel
*.caffemodel
*.params
*.weights
*.bin
*.model

# Model directories
model/
models/
checkpoints/
weights/
pretrained/

# Training data
*.tfrecords
*.recordio
*.mindrecord
*.idx
*.rec

# Temporary files
temp.gitignore`

function parseGitIgnore(content: string): GitIgnoreState {
    const lines: string[] = content.split('\n')
    const startIndex: number = lines.indexOf(AI_SECTION_START)
    const endIndex: number = lines.indexOf(AI_SECTION_END)
    
    if (startIndex === -1 || endIndex === -1) {
        return { 
            aiPatterns: [],
            regularContent: lines
        }
    }
    
    const aiPatterns: string[] = lines.slice(startIndex + 1, endIndex)
        .filter((line: string) => line.trim() && line !== 'ai.gitignore')
    const regularContent: string[] = [...lines.slice(0, startIndex), ...lines.slice(endIndex + 1)]
    
    return { aiPatterns, regularContent }
}

function writeGitIgnore(repoPath: string, state: GitIgnoreState, includeAISection: boolean): void {
    const gitignorePath: string = path.join(repoPath, '.gitignore')
    let content: string[]
    
    if (includeAISection && state.aiPatterns.length > 0) {
        content = [
            ...state.regularContent,
            '',
            AI_SECTION_START,
            'ai.gitignore',
            ...state.aiPatterns,
            AI_SECTION_END,
            ''
        ]
    } else {
        content = [...state.regularContent]
    }
    
    fs.writeFileSync(gitignorePath, content.join('\n'))
}

function readAIGitignorePatterns(repoPath: string): string[] {
    const patterns: string[] = []
    const aiGitignore: string = path.join(repoPath, 'ai.gitignore')
    
    // Only read ai.gitignore from the current workspace
    if (fs.existsSync(aiGitignore)) {
        patterns.push(...fs.readFileSync(aiGitignore, 'utf-8')
            .split('\n')
            .filter((line: string) => line.trim()))
    }
    
    return [...new Set(patterns)]
}

function isIgnoredByAIPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
        // Split pattern into directory and file parts
        const patternParts: string[] = pattern.split('/')
        const fileParts: string[] = filePath.split('/')
        
        // If pattern has more parts than file path, it can't match
        if (patternParts.length > fileParts.length) {
            return false
        }
        
        // For patterns without directory part, match against basename
        if (patternParts.length === 1) {
            const regex: RegExp = new RegExp('^' + patternParts[0]
                .replace(/\./g, '\\.')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '[^/]') + '$')
            return regex.test(path.basename(filePath))
        }
        
        // For patterns with directory part, match full path
        const regexStr: string = patternParts
            .map(part => part
                .replace(/\./g, '\\.')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '[^/]'))
            .join('/')
        
        const regex: RegExp = new RegExp('^' + regexStr + '$')
        return regex.test(filePath)
    })
}

function withoutAIPatterns(repoPath: string, operation: () => any): any {
    const gitignorePath: string = path.join(repoPath, '.gitignore')
    const backupPath: string = path.join(repoPath, '.gitignore.bak')
    
    // Get current AI patterns before modifying .gitignore
    const currentState: GitIgnoreState = fs.existsSync(gitignorePath) 
        ? parseGitIgnore(fs.readFileSync(gitignorePath, 'utf-8'))
        : { aiPatterns: [], regularContent: [] }
    
    // Backup original .gitignore
    if (fs.existsSync(gitignorePath)) {
        fs.copyFileSync(gitignorePath, backupPath)
    }
    
    try {
        // Remove AI section from .gitignore temporarily
        if (fs.existsSync(gitignorePath)) {
            writeGitIgnore(repoPath, { ...currentState, aiPatterns: [] }, false)
        }
        
        // Run the operation
        const result: any = operation()
        
        // Get list of staged files
        const stagedFiles: string[] = execSync('git diff --name-only --cached', {
            cwd: repoPath,
            encoding: 'utf-8'
        }).toString().split('\n').filter((file: string) => file)
        
        // Get list of files that would be staged
        const untrackedFiles: string[] = execSync('git ls-files --others --exclude-standard', {
            cwd: repoPath,
            encoding: 'utf-8'
        }).toString().split('\n').filter((file: string) => file)
        
        // Filter out files that match AI patterns
        const filesToUnstage: string[] = stagedFiles.filter(file => 
            isIgnoredByAIPatterns(file, currentState.aiPatterns)
        )
        
        // Reset any staged files that match AI patterns
        if (filesToUnstage.length > 0) {
            execSync(`git reset HEAD ${filesToUnstage.join(' ')}`, {
                cwd: repoPath,
                stdio: ['pipe', 'pipe', 'pipe']
            })
        }
        
        return result
    } finally {
        // Restore original .gitignore
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, gitignorePath)
            fs.unlinkSync(backupPath)
        }
    }
}

function findWorkspaces(currentDir: string): string[] {
    console.log('[findWorkspaces] Searching in:', currentDir)
    let workspaces: string[] = []

    // Always include the current directory if it has a .git folder
    if (fs.existsSync(path.join(currentDir, '.git'))) {
        console.log('[findWorkspaces] Found git repo in current dir')
        workspaces.push(currentDir)
    }

    // Look for other workspaces in subdirectories
    try {
        const subdirs: string[] = fs.readdirSync(currentDir)
        console.log('[findWorkspaces] Found subdirs:', subdirs)
        for (const subdir of subdirs) {
            const fullPath: string = path.join(currentDir, subdir)
            if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, '.git'))) {
                console.log('[findWorkspaces] Found git repo in:', fullPath)
                workspaces.push(fullPath)
            }
        }
    } catch (error: any) {
        console.error('[findWorkspaces] Error reading directory:', error)
    }

    console.log('[findWorkspaces] Found workspaces:', workspaces)
    return workspaces
}

function setupGitignore(dir: string): void {
    const gitignorePath: string = path.join(dir, '.gitignore')
    const aiGitignorePath: string = path.join(dir, 'ai.gitignore')

    // Create .gitignore if it doesn't exist
    if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, DEFAULT_GITIGNORE)
    } else {
        // Ensure ai.gitignore is listed
        const content: string = fs.readFileSync(gitignorePath, 'utf8')
        if (!content.includes('ai.gitignore')) {
            fs.writeFileSync(gitignorePath, `# AI gitignore file\nai.gitignore\n\n${content}`)
        }
    }

    // Create ai.gitignore if it doesn't exist
    if (!fs.existsSync(aiGitignorePath)) {
        fs.writeFileSync(aiGitignorePath, DEFAULT_AI_GITIGNORE)
    }
}

function extractAISection(dir: string): void {
    console.log('[extractAISection] Processing directory:', dir)
    const gitignorePath: string = path.join(dir, '.gitignore')
    const aiGitignorePath: string = path.join(dir, 'ai.gitignore')

    if (!fs.existsSync(gitignorePath)) {
        console.log('[extractAISection] No .gitignore found')
        return
    }

    const content: string = fs.readFileSync(gitignorePath, 'utf8')
    const lines: string[] = content.split('\n')
    
    console.log('[extractAISection] Content:', content)
    console.log('[extractAISection] Looking for:', AI_SECTION_START)
    console.log('[extractAISection] Lines containing "AI":', lines.filter((l: string) => l.includes('AI')))

    const startIndex: number = lines.indexOf(AI_SECTION_START)
    const endIndex: number = lines.indexOf(AI_SECTION_END)
    
    console.log('[extractAISection] Start index:', startIndex)
    console.log('[extractAISection] End index:', endIndex)

    if (startIndex !== -1 && endIndex !== -1) {
        // Extract AI section
        let aiSection: string = '';
        let inAiSection: boolean = false;

        for (const line of lines) {
            if (line === AI_SECTION_START) {
                inAiSection = true;
            } else if (line === AI_SECTION_END) {
                inAiSection = false;
            } else if (inAiSection && line.trim() && !line.startsWith('#')) {
                aiSection += line + '\n';
            }
        }
            
        console.log('[extractAISection] AI section:', aiSection)

        // Remove section from .gitignore
        const newLines: string[] = [
            ...lines.slice(0, startIndex),
            ...lines.slice(endIndex + 1)
        ]
        
        // Make sure ai.gitignore is in there exactly once
        if (!newLines.includes('ai.gitignore')) {
            newLines.unshift('ai.gitignore')
        }
        
        const newContent: string = newLines.filter((line: string) => line.trim() !== 'ai.gitignore').join('\n') + '\n'
        console.log('[extractAISection] New .gitignore content:', newContent)

        // Write files
        console.log('[extractAISection] Writing files...')
        fs.writeFileSync(gitignorePath, newContent)
        fs.writeFileSync(aiGitignorePath, aiSection)
        
        console.log('[extractAISection] Files written')
        console.log('[extractAISection] Final .gitignore:', fs.readFileSync(gitignorePath, 'utf8'))
        console.log('[extractAISection] Final ai.gitignore:', fs.readFileSync(aiGitignorePath, 'utf8'))
    } else if (!fs.existsSync(aiGitignorePath)) {
        console.log('[extractAISection] No AI section found, creating empty ai.gitignore')
        // No AI section but we need ai.gitignore in .gitignore
        const newContent: string = ['ai.gitignore', content].filter((line: string) => line.trim()).join('\n') + '\n'
        fs.writeFileSync(gitignorePath, newContent)
        fs.writeFileSync(aiGitignorePath, '')
    }
}

function mergeAISection(dir: string): void {
    const gitignorePath: string = path.join(dir, '.gitignore')
    const aiGitignorePath: string = path.join(dir, 'ai.gitignore')

    if (!fs.existsSync(aiGitignorePath)) {
        return
    }

    const aiContent: string = fs.readFileSync(aiGitignorePath, 'utf8')
    let gitignoreContent: string = fs.existsSync(gitignorePath) 
        ? fs.readFileSync(gitignorePath, 'utf8')
        : ''

    // Remove any existing AI section
    const lines: string[] = gitignoreContent.split('\n')
    const startIndex: number = lines.indexOf(AI_SECTION_START)
    const endIndex: number = lines.indexOf(AI_SECTION_END)

    if (startIndex !== -1 && endIndex !== -1) {
        gitignoreContent = [
            ...lines.slice(0, startIndex),
            ...lines.slice(endIndex + 1)
        ].join('\n')
    }

    // Add new AI section
    const newContent: string = `${gitignoreContent.trim()}\n\n${AI_SECTION_START}\n${aiContent}\n${AI_SECTION_END}\n`
    fs.writeFileSync(gitignorePath, newContent)

    // Remove ai.gitignore
    fs.unlinkSync(aiGitignorePath)
}

function gitAdd(paths: string[]): void {
    const repoRoot: string = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
    const currentDir: string = process.cwd()
    
    // First, add .gitignore files to ensure they're tracked
    for (const dir of findWorkspaces(currentDir)) {
        const gitignorePath: string = path.join(dir, '.gitignore')
        if (fs.existsSync(gitignorePath)) {
            execSync(`git add "${gitignorePath}"`, {
                cwd: repoRoot,
                stdio: 'pipe'
            })
        }
    }

    // If in AI mode, we need to check patterns
    if (isAIModeEnabled(currentDir)) {
        // Get all untracked and modified files
        const untrackedOutput: string = execSync(`git ls-files -o --exclude-standard`, {
            encoding: 'utf8',
            cwd: repoRoot
        });
        const untracked: string[] = untrackedOutput.split('\n').filter((f: string) => f);

        // Get list of modified files
        const modifiedOutput: string = execSync(`git ls-files -m`, {
            encoding: 'utf8',
            cwd: repoRoot
        });
        const modified: string[] = modifiedOutput.split('\n').filter((f: string) => f);
        
        const allFiles: string[] = [...new Set([...untracked, ...modified])]
        
        // Get AI patterns from all workspaces
        const allPatterns: string[] = []
        for (const dir of findWorkspaces(currentDir)) {
            const aiGitignorePath: string = path.join(dir, 'ai.gitignore')
            if (fs.existsSync(aiGitignorePath)) {
                const content: string = fs.readFileSync(aiGitignorePath, 'utf8');
                const lines: string[] = content.split('\n').filter((line: string) => line.trim());
                allPatterns.push(...lines)
            }
        }
        
        // Filter out files that match AI patterns
        const filesToAdd: string[] = allFiles.filter((file: string) => {
            return !allPatterns.some((pattern: string) => {
                return minimatch(file, pattern);
            });
        })

        // Add files
        if (filesToAdd.length > 0) {
            const command: string = `git add ${filesToAdd.join(' ')}`;
            execSync(command, { stdio: 'inherit' });
        }
    } else {
        // Not in AI mode, just do normal git add
        execSync(`git add ${paths.length ? paths.join(' ') : '.'}`, {
            cwd: repoRoot,
            stdio: 'pipe'
        })
    }
}

function exitAIMode(repoPath: string): void {
    const gitignorePath: string = path.join(repoPath, '.gitignore')
    const markerPath: string = path.join(repoPath, AI_MODE_MARKER)
    
    if (fs.existsSync(gitignorePath)) {
        const state: GitIgnoreState = parseGitIgnore(fs.readFileSync(gitignorePath, 'utf-8'))
        
        // Remove AI section and marker from .gitignore
        state.regularContent = state.regularContent.filter((line: string) => line.trim() !== AI_MODE_MARKER)
        writeGitIgnore(repoPath, state, false)
    }
    
    // Remove AI mode marker
    if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath)
    }
}

function isAIModeEnabled(dir: string): boolean {
    return fs.existsSync(path.join(dir, 'ai.gitignore'))
}

module.exports = {
    findWorkspaces,
    extractAISection,
    mergeAISection,
    gitAdd,
    isAIModeEnabled,
    withoutAIPatterns,
    setupGitignore,
    exitAIMode
}
