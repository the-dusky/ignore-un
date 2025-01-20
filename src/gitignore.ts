import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import minimatch from 'minimatch'

const AI_SECTION_START = '# --- AI Development Section ---'
const AI_SECTION_END = '# --- End AI Development Section ---'
const AI_MODE_MARKER = '.ai_mode'

const DEFAULT_PATTERNS = [
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

const DEFAULT_GITIGNORE = `# AI gitignore file
ai.gitignore

# Project-specific ignores
.env
.env.local`

const DEFAULT_AI_GITIGNORE = `# AI Development Files
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

interface GitIgnoreState {
    aiPatterns: string[]
    regularContent: string[]
}

/**
 * Check if AI mode is enabled (ai.gitignore exists)
 */
export function isAIModeEnabled(dir: string): boolean {
    return fs.existsSync(path.join(dir, 'ai.gitignore'))
}

function parseGitIgnore(content: string): GitIgnoreState {
    const lines = content.split('\n')
    const startIndex = lines.indexOf(AI_SECTION_START)
    const endIndex = lines.indexOf(AI_SECTION_END)
    
    if (startIndex === -1 || endIndex === -1) {
        return { 
            aiPatterns: [],
            regularContent: lines
        }
    }
    
    const aiPatterns = lines.slice(startIndex + 1, endIndex)
        .filter(line => line.trim() && line !== 'ai.gitignore')
    const regularContent = [...lines.slice(0, startIndex), ...lines.slice(endIndex + 1)]
    
    return { aiPatterns, regularContent }
}

function writeGitIgnore(repoPath: string, state: GitIgnoreState, includeAISection: boolean = false): void {
    const gitignorePath = path.join(repoPath, '.gitignore')
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
    const aiGitignore = path.join(repoPath, 'ai.gitignore')
    
    // Only read ai.gitignore from the current workspace
    if (fs.existsSync(aiGitignore)) {
        patterns.push(...fs.readFileSync(aiGitignore, 'utf-8')
            .split('\n')
            .filter(line => line.trim()))
    }
    
    return [...new Set(patterns)]
}

function isIgnoredByAIPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
        // Split pattern into directory and file parts
        const patternParts = pattern.split('/')
        const fileParts = filePath.split('/')
        
        // If pattern has more parts than file path, it can't match
        if (patternParts.length > fileParts.length) {
            return false
        }
        
        // For patterns without directory part, match against basename
        if (patternParts.length === 1) {
            const regex = new RegExp('^' + patternParts[0]
                .replace(/\./g, '\\.')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '[^/]') + '$')
            return regex.test(path.basename(filePath))
        }
        
        // For patterns with directory part, match full path
        const regexStr = patternParts
            .map(part => part
                .replace(/\./g, '\\.')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '[^/]'))
            .join('/')
        
        const regex = new RegExp('^' + regexStr + '$')
        return regex.test(filePath)
    })
}

export async function withoutAIPatterns<T>(repoPath: string, operation: () => Promise<T>): Promise<T> {
    const gitignorePath = path.join(repoPath, '.gitignore')
    const backupPath = path.join(repoPath, '.gitignore.bak')
    
    // Get current AI patterns before modifying .gitignore
    const currentState = fs.existsSync(gitignorePath) 
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
        const result = await operation()
        
        // Get list of staged files
        const stagedFiles = execSync('git diff --name-only --cached', {
            cwd: repoPath,
            encoding: 'utf-8'
        }).toString().split('\n').filter(Boolean)
        
        // Get list of files that would be staged
        const untrackedFiles = execSync('git ls-files --others --exclude-standard', {
            cwd: repoPath,
            encoding: 'utf-8'
        }).toString().split('\n').filter(Boolean)
        
        // Filter out files that match AI patterns
        const filesToUnstage = stagedFiles.filter(file => 
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

/**
 * Find all workspaces under the current directory
 */
export function findWorkspaces(currentDir: string): string[] {
    console.log('[findWorkspaces] Searching in:', currentDir)
    let workspaces = []

    // Always include the current directory if it has a .git folder
    if (fs.existsSync(path.join(currentDir, '.git'))) {
        console.log('[findWorkspaces] Found git repo in current dir')
        workspaces.push(currentDir)
    }

    // Look for other workspaces in subdirectories
    try {
        const subdirs = fs.readdirSync(currentDir)
        console.log('[findWorkspaces] Found subdirs:', subdirs)
        for (const subdir of subdirs) {
            const fullPath = path.join(currentDir, subdir)
            if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, '.git'))) {
                console.log('[findWorkspaces] Found git repo in:', fullPath)
                workspaces.push(fullPath)
            }
        }
    } catch (error) {
        console.error('[findWorkspaces] Error reading directory:', error)
    }

    console.log('[findWorkspaces] Found workspaces:', workspaces)
    return workspaces
}

/**
 * Ensure .gitignore and ai.gitignore exist with proper content
 */
export function setupGitignore(dir: string): void {
    const gitignorePath = path.join(dir, '.gitignore')
    const aiGitignorePath = path.join(dir, 'ai.gitignore')

    // Create .gitignore if it doesn't exist
    if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, DEFAULT_GITIGNORE)
    } else {
        // Ensure ai.gitignore is listed
        const content = fs.readFileSync(gitignorePath, 'utf8')
        if (!content.includes('ai.gitignore')) {
            fs.writeFileSync(gitignorePath, `# AI gitignore file\nai.gitignore\n\n${content}`)
        }
    }

    // Create ai.gitignore if it doesn't exist
    if (!fs.existsSync(aiGitignorePath)) {
        fs.writeFileSync(aiGitignorePath, DEFAULT_AI_GITIGNORE)
    }
}

/**
 * Extract AI section from .gitignore to ai.gitignore
 */
export function extractAISection(dir: string): void {
    console.log('[extractAISection] Processing directory:', dir)
    const gitignorePath = path.join(dir, '.gitignore')
    const aiGitignorePath = path.join(dir, 'ai.gitignore')

    if (!fs.existsSync(gitignorePath)) {
        console.log('[extractAISection] No .gitignore found')
        return
    }

    const content = fs.readFileSync(gitignorePath, 'utf8')
    const lines = content.split('\n')
    
    console.log('[extractAISection] Content:', content)
    console.log('[extractAISection] Looking for:', AI_SECTION_START)
    console.log('[extractAISection] Lines containing "AI":', lines.filter(l => l.includes('AI')))

    const startIndex = lines.indexOf(AI_SECTION_START)
    const endIndex = lines.indexOf(AI_SECTION_END)
    
    console.log('[extractAISection] Start index:', startIndex)
    console.log('[extractAISection] End index:', endIndex)

    if (startIndex !== -1 && endIndex !== -1) {
        // Extract AI section
        const aiSection = lines.slice(startIndex + 1, endIndex)
            .filter(line => line.trim() && !line.startsWith('#'))
            
        console.log('[extractAISection] AI section:', aiSection)

        // Remove section from .gitignore
        const newLines = [
            ...lines.slice(0, startIndex),
            ...lines.slice(endIndex + 1)
        ]
        
        // Make sure ai.gitignore is in there exactly once
        if (!newLines.includes('ai.gitignore')) {
            newLines.unshift('ai.gitignore')
        }
        
        const newContent = newLines.filter(line => line.trim()).join('\n') + '\n'
        console.log('[extractAISection] New .gitignore content:', newContent)

        // Write files
        console.log('[extractAISection] Writing files...')
        fs.writeFileSync(gitignorePath, newContent)
        fs.writeFileSync(aiGitignorePath, aiSection.join('\n') + '\n')
        
        console.log('[extractAISection] Files written')
        console.log('[extractAISection] Final .gitignore:', fs.readFileSync(gitignorePath, 'utf8'))
        console.log('[extractAISection] Final ai.gitignore:', fs.readFileSync(aiGitignorePath, 'utf8'))
    } else if (!fs.existsSync(aiGitignorePath)) {
        console.log('[extractAISection] No AI section found, creating empty ai.gitignore')
        // No AI section but we need ai.gitignore in .gitignore
        const newContent = ['ai.gitignore', content].filter(line => line.trim()).join('\n') + '\n'
        fs.writeFileSync(gitignorePath, newContent)
        fs.writeFileSync(aiGitignorePath, '')
    }
}

/**
 * Merge ai.gitignore back into .gitignore
 */
export function mergeAISection(dir: string): void {
    const gitignorePath = path.join(dir, '.gitignore')
    const aiGitignorePath = path.join(dir, 'ai.gitignore')

    if (!fs.existsSync(aiGitignorePath)) {
        return
    }

    const aiContent = fs.readFileSync(aiGitignorePath, 'utf8')
    let gitignoreContent = fs.existsSync(gitignorePath) 
        ? fs.readFileSync(gitignorePath, 'utf8')
        : ''

    // Remove any existing AI section
    const lines = gitignoreContent.split('\n')
    const startIndex = lines.indexOf(AI_SECTION_START)
    const endIndex = lines.indexOf(AI_SECTION_END)

    if (startIndex !== -1 && endIndex !== -1) {
        gitignoreContent = [
            ...lines.slice(0, startIndex),
            ...lines.slice(endIndex + 1)
        ].join('\n')
    }

    // Add new AI section
    const newContent = `${gitignoreContent.trim()}\n\n${AI_SECTION_START}\n${aiContent}\n${AI_SECTION_END}\n`
    fs.writeFileSync(gitignorePath, newContent)

    // Remove ai.gitignore
    fs.unlinkSync(aiGitignorePath)
}

/**
 * Handle git add with proper gitignore handling
 */
export function gitAdd(paths: string[]): void {
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
    const currentDir = process.cwd()
    
    // First, add .gitignore files to ensure they're tracked
    for (const dir of findWorkspaces(currentDir)) {
        const gitignorePath = path.join(dir, '.gitignore')
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
        const untracked = execSync(`git ls-files -o --exclude-standard`, {
            cwd: repoRoot,
            encoding: 'utf8'
        }).split('\n').filter(f => f.trim())
        
        const modified = execSync(`git ls-files -m`, {
            cwd: repoRoot,
            encoding: 'utf8'
        }).split('\n').filter(f => f.trim())
        
        const allFiles = [...new Set([...untracked, ...modified])]
        
        // Get AI patterns from all workspaces
        const allPatterns: string[] = []
        for (const dir of findWorkspaces(currentDir)) {
            const aiGitignorePath = path.join(dir, 'ai.gitignore')
            if (fs.existsSync(aiGitignorePath)) {
                const patterns = fs.readFileSync(aiGitignorePath, 'utf8')
                    .split('\n')
                    .filter(line => line.trim() && !line.startsWith('#'))
                allPatterns.push(...patterns)
            }
        }
        
        // Add files that don't match AI patterns
        const filesToAdd = allFiles.filter(file => 
            !allPatterns.some(pattern => minimatch(file, pattern, { matchBase: true }))
        )
        
        if (filesToAdd.length > 0) {
            execSync(`git add ${filesToAdd.map(f => `"${f}"`).join(' ')}`, {
                cwd: repoRoot,
                stdio: 'pipe'
            })
        }
    } else {
        // Not in AI mode, just do normal git add
        execSync(`git add ${paths.length ? paths.join(' ') : '.'}`, {
            cwd: repoRoot,
            stdio: 'pipe'
        })
    }
}

/**
 * Exit AI mode
 */
export function exitAIMode(repoPath: string): void {
    const gitignorePath = path.join(repoPath, '.gitignore')
    const markerPath = path.join(repoPath, AI_MODE_MARKER)
    
    if (fs.existsSync(gitignorePath)) {
        const state = parseGitIgnore(fs.readFileSync(gitignorePath, 'utf-8'))
        
        // Remove AI section and marker from .gitignore
        state.regularContent = state.regularContent.filter(line => line.trim() !== AI_MODE_MARKER)
        writeGitIgnore(repoPath, state, false)
    }
    
    // Remove AI mode marker
    if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath)
    }
}
