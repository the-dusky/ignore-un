"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemGitIgnoreManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const types_1 = require("./types");
class FileSystemGitIgnoreManager {
    findWorkspaces(rootDir) {
        const workspaces = [];
        // Always include current directory if it's a workspace
        if (fs_1.default.existsSync(path_1.default.join(rootDir, 'package.json'))) {
            workspaces.push(this.createWorkspaceConfig(rootDir));
        }
        // Find all package.json files
        const findPackageJson = (dir) => {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === 'node_modules')
                    continue;
                const fullPath = path_1.default.join(dir, entry.name);
                if (entry.isDirectory()) {
                    findPackageJson(fullPath);
                }
                else if (entry.name === 'package.json') {
                    workspaces.push(this.createWorkspaceConfig(path_1.default.dirname(fullPath)));
                }
            }
        };
        findPackageJson(rootDir);
        return workspaces;
    }
    readGitIgnore(filePath) {
        const sections = [];
        let currentSection = null;
        let defaultContent = [];
        if (!fs_1.default.existsSync(filePath)) {
            return { path: filePath, sections: [] };
        }
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
            if (line === types_1.AI_SECTION.startMarker) {
                currentSection = {
                    name: types_1.AI_SECTION.name,
                    content: [],
                    startMarker: types_1.AI_SECTION.startMarker,
                    endMarker: types_1.AI_SECTION.endMarker
                };
            }
            else if (line === types_1.AI_SECTION.endMarker && currentSection) {
                sections.push(currentSection);
                currentSection = null;
            }
            else if (currentSection) {
                currentSection.content.push(line);
            }
            else {
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
    writeGitIgnore(file) {
        const content = [];
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
        fs_1.default.writeFileSync(file.path, content.join('\n'));
    }
    extractAiSection(gitignore) {
        const aiSection = gitignore.sections.find(s => s.name === types_1.AI_SECTION.name);
        if (!aiSection)
            return null;
        // Remove AI section from gitignore
        gitignore.sections = gitignore.sections.filter(s => s !== aiSection);
        return aiSection;
    }
    mergeAiSection(gitignore, aiSection) {
        // Remove any existing AI section
        gitignore.sections = gitignore.sections.filter(s => s.name !== types_1.AI_SECTION.name);
        // Add new AI section
        gitignore.sections.push(aiSection);
    }
    createWorkspaceConfig(dir) {
        return {
            path: dir,
            hasPackageJson: true,
            gitignorePath: path_1.default.join(dir, '.gitignore'),
            aiGitignorePath: path_1.default.join(dir, 'ai.gitignore')
        };
    }
}
exports.FileSystemGitIgnoreManager = FileSystemGitIgnoreManager;
