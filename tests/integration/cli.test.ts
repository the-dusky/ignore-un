import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '../..')
const CLI_PATH = path.resolve(PROJECT_ROOT, 'src/cli.ts')
const TSX_PATH = path.resolve(PROJECT_ROOT, 'node_modules/.bin/tsx')

const AI_SECTION_START = '# --- AI Development Section ---'
const AI_SECTION_END = '# --- End AI Development Section ---'

describe('CLI Integration', () => {
    let repoPath: string
    
    beforeEach(() => {
        // Create temp directory
        repoPath = fs.mkdtempSync('/tmp/git-aiadd-test-')
        
        // Initialize git repo
        execSync('git init', { cwd: repoPath })
        execSync('git config user.name "Test User"', { cwd: repoPath })
        execSync('git config user.email "test@example.com"', { cwd: repoPath })
    })
    
    afterEach(() => {
        // Cleanup
        fs.rmSync(repoPath, { recursive: true, force: true })
    })
    
    test('should properly move AI patterns when turning on AI mode', async () => {
        // Setup: Create .gitignore with AI section
        fs.writeFileSync(path.join(repoPath, '.gitignore'), `# Regular patterns
node_modules

${AI_SECTION_START}
*.onnx
model/weights/
${AI_SECTION_END}`)
        
        // Turn ON mode
        execSync(`${TSX_PATH} ${CLI_PATH} on`, { cwd: repoPath })
        
        // Verify .gitignore content
        const gitignoreContent = fs.readFileSync(path.join(repoPath, '.gitignore'), 'utf8')
        console.log('gitignore content:', gitignoreContent)
        expect(gitignoreContent).toContain('node_modules')
        expect(gitignoreContent).toContain('ai.gitignore')
        expect(gitignoreContent).not.toContain('*.onnx')
        expect(gitignoreContent).not.toContain('model/weights/')
        
        // Verify ai.gitignore exists and has patterns
        const aiGitignoreContent = fs.readFileSync(path.join(repoPath, 'ai.gitignore'), 'utf8')
        console.log('ai.gitignore content:', aiGitignoreContent)
        expect(aiGitignoreContent).toContain('*.onnx')
        expect(aiGitignoreContent).toContain('model/weights/')
    })
})
