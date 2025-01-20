import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { createTempGitRepo, cleanupTempRepo } from '../setup'

describe('monorepo gitignore integration', () => {
  let tempDir: string
  const fixtureDir = path.join(__dirname, '../fixtures/complex-monorepo')

  beforeEach(() => {
    // Create a fresh repo with fixture content
    tempDir = createTempGitRepo('monorepo-test')
    
    // Copy fixture to temp dir
    execSync(`cp -R ${fixtureDir}/* ${tempDir}/`)
    
    // Initialize git
    execSync('git init', { cwd: tempDir })
  })

  afterEach(() => {
    cleanupTempRepo(tempDir)
  })

  it('should handle complex monorepo structure', async () => {
    // Create test files across workspaces
    const testFiles = [
      'apps/ml-workspace/data/interim/train.csv',
      'apps/ml-workspace/data/interim/validation_set.csv',
      'apps/ml-workspace/checkpoints/exp1/best.pt',
      'apps/ml-workspace/checkpoints/exp1/latest.pt'
    ]
    
    testFiles.forEach(file => {
      const filePath = path.join(tempDir, file)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, 'test content')
    })
    
    // Add all files
    execSync('git add .', { cwd: tempDir })
    
    // Check git status
    const status = execSync('git status --porcelain', { cwd: tempDir }).toString()
    
    // Verify correct files are tracked/ignored
    expect(status).toContain('validation_set.csv')  // Should be tracked
    expect(status).toContain('best.pt')            // Should be tracked
    expect(status).not.toContain('train.csv')      // Should be ignored
    expect(status).not.toContain('latest.pt')      // Should be ignored
  })

  it('should handle ai.gitignore activation/deactivation', async () => {
    // Create ai.gitignore with additional patterns
    const aiGitignore = path.join(tempDir, 'apps/ml-workspace/ai.gitignore')
    fs.writeFileSync(aiGitignore, '*.temp\n*.log')
    
    // Create test files
    const testFiles = [
      'apps/ml-workspace/test.temp',
      'apps/ml-workspace/debug.log',
      'apps/ml-workspace/important.txt'
    ]
    
    testFiles.forEach(file => {
      fs.writeFileSync(path.join(tempDir, file), 'test content')
    })
    
    // Test normal state (ai.gitignore active)
    execSync('git add .', { cwd: tempDir })
    let status = execSync('git status --porcelain', { cwd: tempDir }).toString()
    expect(status).not.toContain('test.temp')
    expect(status).not.toContain('debug.log')
    expect(status).toContain('important.txt')
    
    // TODO: Test git-aiadd command when implemented
    // This would temporarily disable ai.gitignore and allow adding ignored files
  })
})
