import { beforeAll, afterAll, afterEach } from 'vitest'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

// Helper to create a temporary git repo for testing
export const createTempGitRepo = (fixtureName: string) => {
  const tempDir = path.join(__dirname, 'temp', fixtureName)
  fs.mkdirSync(tempDir, { recursive: true })
  execSync('git init', { cwd: tempDir })
  return tempDir
}

// Clean up function
export const cleanupTempRepo = (tempDir: string) => {
  fs.rmSync(tempDir, { recursive: true, force: true })
}

// Setup and teardown for each test suite
beforeAll(() => {
  // Create temp directory for test repos
  fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true })
})

afterAll(() => {
  // Clean up all temp directories
  fs.rmSync(path.join(__dirname, 'temp'), { recursive: true, force: true })
})

afterEach(() => {
  // Reset any mocks or test state
})
