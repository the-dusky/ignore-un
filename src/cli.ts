#!/usr/bin/env node
import { Command } from 'commander';
import { findWorkspaces, extractAISection, mergeAISection, gitAdd, isAIModeEnabled } from './gitignore.js';

const program = new Command();

program
    .name('git-aiadd')
    .description('Git add wrapper for AI development')
    .version('1.0.3');

program
    .command('on')
    .description('Enter AI development mode')
    .action(() => {
        const currentDir = process.cwd();
        console.log('Current dir:', currentDir);
        const workspaces = findWorkspaces(currentDir);
        console.log('Workspaces:', workspaces);
        for (const dir of workspaces) {
            extractAISection(dir);
        }
    });

program
    .command('off')
    .description('Exit AI development mode')
    .action(() => {
        const currentDir = process.cwd();
        const workspaces = findWorkspaces(currentDir);
        for (const dir of workspaces) {
            if (isAIModeEnabled(dir)) {
                mergeAISection(dir);
            }
        }
    });

program
    .argument('[files...]')
    .description('Add files while respecting AI patterns')
    .action((files: string[]) => {
        gitAdd(files);
    });

program.parse();
