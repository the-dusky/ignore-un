import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestRepo, cleanupTestRepo, createFile, getGitStatus, addAndCommit, commitGitignore } from './helpers'
import { enterAIMode, exitAIMode, isAIModeEnabled, withoutAIPatterns } from '../src/gitignore'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

describe('gitignore management', () => {
  let repoPath: string

  beforeEach(() => {
    repoPath = createTestRepo()
  })

  afterEach(() => {
    cleanupTestRepo(repoPath)
  })

  describe('AI mode state', () => {
    it('should start with AI mode disabled', () => {
      expect(isAIModeEnabled(repoPath)).toBe(false)
    })

    it('should enable AI mode', () => {
      enterAIMode(repoPath)
      expect(isAIModeEnabled(repoPath)).toBe(true)
    })

    it('should disable AI mode', () => {
      enterAIMode(repoPath)
      exitAIMode(repoPath)
      expect(isAIModeEnabled(repoPath)).toBe(false)
    })

    it('should handle entering AI mode with existing patterns', () => {
      // Setup initial state with patterns in ai.gitignore
      const aiPatterns = '*.temp\n*.log'
      fs.writeFileSync(path.join(repoPath, 'ai.gitignore'), aiPatterns)
      
      enterAIMode(repoPath)
      
      // Verify patterns are in .gitignore
      const gitignore = fs.readFileSync(path.join(repoPath, '.gitignore'), 'utf-8')
      expect(gitignore).toContain('*.temp')
      expect(gitignore).toContain('*.log')
    })

    it('should handle exiting AI mode and preserve patterns', () => {
      // Setup initial state
      const aiPatterns = '*.temp\n*.log'
      fs.writeFileSync(path.join(repoPath, 'ai.gitignore'), aiPatterns)
      
      enterAIMode(repoPath)
      exitAIMode(repoPath)
      
      // Verify patterns are preserved in ai.gitignore
      const preserved = fs.readFileSync(path.join(repoPath, 'ai.gitignore'), 'utf-8')
      expect(preserved).toContain('*.temp')
      expect(preserved).toContain('*.log')
      
      // Verify patterns are removed from .gitignore
      const gitignore = fs.readFileSync(path.join(repoPath, '.gitignore'), 'utf-8')
      expect(gitignore).not.toContain('*.temp')
      expect(gitignore).not.toContain('*.log')
    })

    it('should handle node_modules directory', () => {
      // Create node_modules
      const nodeModulesPath = path.join(repoPath, 'node_modules')
      fs.mkdirSync(nodeModulesPath)
      fs.writeFileSync(path.join(nodeModulesPath, 'test.js'), 'test')

      // Enable AI mode
      enterAIMode(repoPath)

      // Try to add everything
      execSync('git add .', { cwd: repoPath })

      // Check that node_modules is ignored
      const status = execSync('git status --porcelain', { 
        cwd: repoPath,
        encoding: 'utf-8' 
      })
      expect(status).not.toContain('node_modules')
    })

    it('should handle empty ai.gitignore', () => {
      // Create empty ai.gitignore
      fs.writeFileSync(path.join(repoPath, 'ai.gitignore'), '')
      
      // Enable AI mode should not fail
      expect(() => enterAIMode(repoPath)).not.toThrow()
      
      // Check .gitignore doesn't have empty lines
      const gitignore = fs.readFileSync(path.join(repoPath, '.gitignore'), 'utf-8')
      expect(gitignore.split('\n').filter(line => line.trim() === '').length).toBeLessThanOrEqual(1)
    })

    it('should handle non-existent ai.gitignore', () => {
      // Enable AI mode without ai.gitignore
      expect(() => enterAIMode(repoPath)).not.toThrow()
      
      // Should create default .gitignore with common patterns
      const gitignore = fs.readFileSync(path.join(repoPath, '.gitignore'), 'utf-8')
      expect(gitignore).toContain('node_modules')
      expect(gitignore).toContain('.env')
      expect(gitignore).toContain('.idea')
      expect(gitignore).toContain('dist')
    })

    it('should handle invalid patterns in ai.gitignore', () => {
      // Create ai.gitignore with invalid pattern
      fs.writeFileSync(path.join(repoPath, 'ai.gitignore'), '[invalid pattern')
      
      // Enable AI mode should not fail
      expect(() => enterAIMode(repoPath)).not.toThrow()
      
      // Pattern should be in AI section
      const gitignore = fs.readFileSync(path.join(repoPath, '.gitignore'), 'utf-8')
      expect(gitignore).toContain('[invalid pattern')
    })

    it('should handle deeply nested gitignore files', () => {
      // Create nested structure
      const nestedPath = path.join(repoPath, 'deep/nested/dir')
      fs.mkdirSync(nestedPath, { recursive: true })
      
      // Create nested ai.gitignore
      fs.writeFileSync(path.join(nestedPath, 'ai.gitignore'), '*.model')
      
      // Create test file
      fs.writeFileSync(path.join(nestedPath, 'test.model'), 'test')
      
      // Enable AI mode
      enterAIMode(repoPath)
      
      // Try to add everything
      execSync('git add .', { cwd: repoPath })
      
      // Check that nested file is not added
      const status = execSync('git status --porcelain', { 
        cwd: repoPath,
        encoding: 'utf-8' 
      })
      expect(status).not.toContain('test.model')
    })
  })

  describe('git operations', () => {
    it('should handle untracked files', () => {
      createFile(repoPath, 'test.txt', 'test content')
      const status = getGitStatus(repoPath)
      expect(status).toContain('?? test.txt')
    })

    it('should handle tracked files', () => {
      createFile(repoPath, 'test.txt', 'test content')
      addAndCommit(repoPath, 'test.txt', 'Add test file')
      const status = getGitStatus(repoPath)
      expect(status).toHaveLength(0)
    })

    it('should respect AI patterns when adding files', async () => {
      // Create test files
      createFile(repoPath, 'test.txt', 'test content')
      createFile(repoPath, 'test.temp', 'temp content')
      
      // Setup AI mode with patterns
      fs.writeFileSync(path.join(repoPath, 'ai.gitignore'), '*.temp')
      enterAIMode(repoPath)
      
      // Add files using withoutAIPatterns
      await withoutAIPatterns(repoPath, async () => {
        execSync('git add .', { cwd: repoPath })
        return Promise.resolve()
      })
      
      // Check that test.txt is staged but test.temp is not
      const status = getGitStatus(repoPath)
      expect(status).toContain('A  test.txt')
      
      // Check that test.temp is actually ignored
      const isIgnored = execSync('git status --porcelain', { 
        cwd: repoPath,
        encoding: 'utf8' 
      }).toString().trim()
      expect(isIgnored).not.toContain('test.temp')
    })
  })
})
