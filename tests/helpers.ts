import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

/**
 * Creates a temporary git repository for testing
 * @returns Path to the temporary repository
 */
export function createTestRepo() {
  // Create temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-test-'))
  
  // Ensure directory exists
  fs.mkdirSync(tempDir, { recursive: true })
  
  // Initialize git repo
  execSync('git init', { cwd: tempDir })
  execSync('git config --local user.name "Test User"', { cwd: tempDir })
  execSync('git config --local user.email "test@example.com"', { cwd: tempDir })
  
  // Create initial commit so we can create more
  fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Repo\n')
  execSync('git add README.md', { cwd: tempDir })
  execSync('git commit -m "Initial commit"', { cwd: tempDir })
  
  return tempDir
}

/**
 * Cleans up a test repository
 */
export function cleanupTestRepo(repoPath: string) {
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true })
  }
}

/**
 * Creates a file with content in the repository
 */
export function createFile(repoPath: string, filename: string, content: string) {
  fs.writeFileSync(path.join(repoPath, filename), content)
}

/**
 * Gets git status in a structured format
 */
export function getGitStatus(repoPath: string) {
  const output = execSync('git status --porcelain', { 
    cwd: repoPath,
    encoding: 'utf-8'
  })
  return output.split('\n').filter(Boolean)
}

/**
 * Adds and commits a file
 */
export function addAndCommit(repoPath: string, file: string, message: string) {
  execSync(`git add ${file}`, { cwd: repoPath })
  execSync(`git commit -m "${message}"`, { cwd: repoPath })
}

/**
 * Commits .gitignore changes
 */
export function commitGitignore(repoPath: string) {
  execSync('git add .gitignore', { cwd: repoPath })
  execSync('git commit -m "Update gitignore"', { cwd: repoPath })
}
