#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { findWorkspaces, extractAISection, mergeAISection, gitAdd, isAIModeEnabled } from './gitignore';

const program = new Command();

program
    .name('git-aiadd')
    .description('Git add wrapper for AI development')
    .version('1.0.0');

program
    .command('on')
    .description('Enter AI development mode')
    .action(() => {
        const currentDir = process.cwd();
        console.log('Current dir:', currentDir);
        const workspaces: string[] = findWorkspaces(currentDir);
        console.log('Workspaces:', workspaces);
        for (const dir of workspaces) {
            const aiSection = extractAISection(dir);
            if (aiSection) {
                mergeAISection(dir, aiSection);
            }
        }
        console.log('AI development mode enabled');
    });

program
    .command('off')
    .description('Exit AI development mode')
    .action(() => {
        const currentDir = process.cwd();
        const workspaces: string[] = findWorkspaces(currentDir);
        console.log('Workspaces:', workspaces);
        for (const dir of workspaces) {
            console.log('Processing workspace:', dir);
            if (isAIModeEnabled(dir)) {
                mergeAISection(dir, '');
            }
        }
        console.log('AI development mode disabled');
    });

program
    .command('status')
    .description('Check AI development mode status')
    .action(() => {
        const currentDir = process.cwd();
        console.log('Current dir:', currentDir);
        const enabled = isAIModeEnabled(currentDir);
        console.log(`AI mode ${enabled ? 'enabled' : 'disabled'}`);
    });

program
    .argument('[files...]')
    .description('Add files while respecting AI patterns')
    .action((files: string[]) => {
        gitAdd(files);
    });

program.parse();
