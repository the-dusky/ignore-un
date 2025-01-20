export interface GitIgnoreSection {
  name: string;
  content: string[];
  startMarker: string;
  endMarker: string;
}

export interface GitIgnoreFile {
  path: string;
  sections: GitIgnoreSection[];
  defaultSection?: GitIgnoreSection;
}

export interface WorkspaceConfig {
  path: string;
  hasPackageJson: boolean;
  gitignorePath: string;
  aiGitignorePath: string;
}

export interface GitIgnoreManager {
  findWorkspaces(rootDir: string): WorkspaceConfig[];
  readGitIgnore(path: string): GitIgnoreFile;
  writeGitIgnore(file: GitIgnoreFile): void;
  extractAiSection(gitignore: GitIgnoreFile): GitIgnoreSection | null;
  mergeAiSection(gitignore: GitIgnoreFile, aiSection: GitIgnoreSection): void;
}

export const AI_SECTION = {
  name: 'AI Development',
  startMarker: '# --- AI Development Section ---',
  endMarker: '# --- End AI Development Section ---'
} as const;
