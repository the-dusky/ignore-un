import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { createTempGitRepo, cleanupTempRepo } from '../setup'

describe('gitignore management', () => {
  let tempDir: string

  beforeEach(() => {
    // Create a fresh repo for each test
    tempDir = createTempGitRepo('gitignore-test')
    
    // Create test monorepo structure
    const dirs = [
      'apps/web-client',
      'apps/ml-workspace',
      'shared/assets'
    ]
    dirs.forEach(dir => fs.mkdirSync(path.join(tempDir, dir), { recursive: true }))
  })

  afterEach(() => {
    cleanupTempRepo(tempDir)
  })

  it('should create gitignore with AI section', () => {
    // Create root .gitignore
    const gitignore = `# Dependencies
node_modules/

# --- AI Development Section ---
ai.gitignore
*.temp
# --- End AI Development Section ---`

    fs.writeFileSync(path.join(tempDir, '.gitignore'), gitignore)
    
    // Verify file exists and content is correct
    const content = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8')
    expect(content).toContain('AI Development Section')
    expect(content).toContain('ai.gitignore')
  })

  it('should ignore files based on ai.gitignore when enabled', () => {
    // Create .gitignore and ai.gitignore
    fs.writeFileSync(path.join(tempDir, '.gitignore'), 'ai.gitignore')
    fs.writeFileSync(path.join(tempDir, 'ai.gitignore'), '*.temp')
    
    // Create test files
    fs.writeFileSync(path.join(tempDir, 'test.temp'), 'temp file')
    fs.writeFileSync(path.join(tempDir, 'test.txt'), 'normal file')
    
    // Add files
    execSync('git add .', { cwd: tempDir })
    
    // Check git status
    const status = execSync('git status --porcelain', { cwd: tempDir }).toString()
    expect(status).not.toContain('test.temp')
    expect(status).toContain('test.txt')
  })

  it('should handle nested workspace gitignores', () => {
    // Create workspace .gitignore files
    const workspaces = ['apps/web-client', 'apps/ml-workspace']
    workspaces.forEach(workspace => {
      fs.writeFileSync(path.join(tempDir, workspace, '.gitignore'), `# --- AI Development Section ---
ai.gitignore
*.local
# --- End AI Development Section ---`)
    })
    
    // Create test files
    workspaces.forEach(workspace => {
      fs.writeFileSync(path.join(tempDir, workspace, 'config.local'), 'local config')
      fs.writeFileSync(path.join(tempDir, workspace, 'config.prod'), 'prod config')
    })
    
    // Add files
    execSync('git add .', { cwd: tempDir })
    
    // Check git status
    const status = execSync('git status --porcelain', { cwd: tempDir }).toString()
    expect(status).not.toContain('config.local')
    expect(status).toContain('config.prod')
  })
})
