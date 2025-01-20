import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { createTempGitRepo, cleanupTempRepo } from '../setup'

describe('monorepo gitignore management', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempGitRepo('monorepo-test')
  })

  afterEach(() => {
    cleanupTempRepo(tempDir)
  })

  it('should handle ai.gitignore activation/deactivation', () => {
    // Create test files
    const testFiles = [
      'apps/ml-workspace/test.temp',
      'apps/ml-workspace/debug.log',
      'apps/ml-workspace/important.txt'
    ]
    
    // Create .gitignore with AI section
    const gitignoreContent = `
# Regular ignores
node_modules/

# --- AI Development Section ---
*.temp
*.log
# --- End AI Development Section ---
`
    fs.writeFileSync(path.join(tempDir, '.gitignore'), gitignoreContent)
    
    // Create test files
    testFiles.forEach(file => {
      const filePath = path.join(tempDir, file)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, 'test content')
    })
    
    // Test normal state (ai.gitignore active)
    execSync('git add .', { cwd: tempDir })
    let status = execSync('git status --porcelain', { cwd: tempDir }).toString()
    expect(status).not.toContain('test.temp')
    expect(status).not.toContain('debug.log')
    expect(status).toContain('important.txt')
    
    // Extract AI section to ai.gitignore
    const aiContent = `*.temp
*.log`
    fs.writeFileSync(path.join(tempDir, 'ai.gitignore'), aiContent)
    
    // Update .gitignore without AI section
    const cleanGitignore = `
# Regular ignores
node_modules/
`
    fs.writeFileSync(path.join(tempDir, '.gitignore'), cleanGitignore)
    
    // Test with ai.gitignore deactivated
    execSync('git add .', { cwd: tempDir })
    status = execSync('git status --porcelain', { cwd: tempDir }).toString()
    expect(status).toContain('test.temp')
    expect(status).toContain('debug.log')
    expect(status).toContain('important.txt')
  })
})
