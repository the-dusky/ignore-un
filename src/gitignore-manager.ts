import fs from 'fs';
import path from 'path';
import {
  GitIgnoreSection,
  GitIgnoreFile,
  WorkspaceConfig,
  GitIgnoreManager,
  AI_SECTION
} from './types';

export class FileSystemGitIgnoreManager implements GitIgnoreManager {
  findWorkspaces(rootDir: string): WorkspaceConfig[] {
    const workspaces: WorkspaceConfig[] = [];
    
    // Always include current directory if it's a workspace
    if (fs.existsSync(path.join(rootDir, 'package.json'))) {
      workspaces.push(this.createWorkspaceConfig(rootDir));
    }
    
    // Find all package.json files
    const findPackageJson = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name === 'node_modules') continue;
        
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findPackageJson(fullPath);
        } else if (entry.name === 'package.json') {
          workspaces.push(this.createWorkspaceConfig(path.dirname(fullPath)));
        }
      }
    };
    
    findPackageJson(rootDir);
    return workspaces;
  }
  
  readGitIgnore(filePath: string): GitIgnoreFile {
    const sections: GitIgnoreSection[] = [];
    let currentSection: GitIgnoreSection | null = null;
    let defaultContent: string[] = [];
    
    if (!fs.existsSync(filePath)) {
      return { path: filePath, sections: [] };
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line === AI_SECTION.startMarker) {
        currentSection = {
          name: AI_SECTION.name,
          content: [],
          startMarker: AI_SECTION.startMarker,
          endMarker: AI_SECTION.endMarker
        };
      } else if (line === AI_SECTION.endMarker && currentSection) {
        sections.push(currentSection);
        currentSection = null;
      } else if (currentSection) {
        currentSection.content.push(line);
      } else {
        defaultContent.push(line);
      }
    }
    
    return {
      path: filePath,
      sections,
      defaultSection: {
        name: 'default',
        content: defaultContent,
        startMarker: '',
        endMarker: ''
      }
    };
  }
  
  writeGitIgnore(file: GitIgnoreFile): void {
    const content: string[] = [];
    
    // Write default section first
    if (file.defaultSection) {
      content.push(...file.defaultSection.content);
    }
    
    // Write other sections
    for (const section of file.sections) {
      content.push('');
      content.push(section.startMarker);
      content.push(...section.content);
      content.push(section.endMarker);
    }
    
    fs.writeFileSync(file.path, content.join('\n'));
  }
  
  extractAiSection(gitignore: GitIgnoreFile): GitIgnoreSection | null {
    const aiSection = gitignore.sections.find(s => s.name === AI_SECTION.name);
    if (!aiSection) return null;
    
    // Remove AI section from gitignore
    gitignore.sections = gitignore.sections.filter(s => s !== aiSection);
    
    return aiSection;
  }
  
  mergeAiSection(gitignore: GitIgnoreFile, aiSection: GitIgnoreSection): void {
    // Remove any existing AI section
    gitignore.sections = gitignore.sections.filter(s => s.name !== AI_SECTION.name);
    
    // Add new AI section
    gitignore.sections.push(aiSection);
  }
  
  private createWorkspaceConfig(dir: string): WorkspaceConfig {
    return {
      path: dir,
      hasPackageJson: true,
      gitignorePath: path.join(dir, '.gitignore'),
      aiGitignorePath: path.join(dir, 'ai.gitignore')
    };
  }
}
