import { beforeAll, afterAll, afterEach } from 'vitest'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

// Helper to create a temporary git repo for testing
export const createTempGitRepo = (fixtureName: string) => {
  const tempDir = path.join(__dirname, 'temp', fixtureName)
  
  // Clean up if exists
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
  
  // Create directory structure
  fs.mkdirSync(tempDir, { recursive: true })
  fs.mkdirSync(path.join(tempDir, 'apps/ml-workspace'), { recursive: true })
  
  // Initialize git
  execSync('git init', { cwd: tempDir })
  execSync('git config --local user.name "Test User"', { cwd: tempDir })
  execSync('git config --local user.email "test@example.com"', { cwd: tempDir })
  
  return tempDir
}

// Clean up function
export const cleanupTempRepo = (tempDir: string) => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

// Setup and teardown for each test suite
beforeAll(() => {
  // Create base temp directory
  const baseTemp = path.join(__dirname, 'temp')
  if (!fs.existsSync(baseTemp)) {
    fs.mkdirSync(baseTemp, { recursive: true })
  }
})

afterAll(() => {
  // Clean up base temp directory
  const baseTemp = path.join(__dirname, 'temp')
  if (fs.existsSync(baseTemp)) {
    fs.rmSync(baseTemp, { recursive: true, force: true })
  }
})

afterEach(() => {
  // Reset any mocks or test state
})
