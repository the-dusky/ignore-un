#!/usr/bin/env node
const { Command } = require('commander');
const path = require('path');
const { findWorkspaces, extractAISection, mergeAISection, gitAdd, isAIModeEnabled } = require('./gitignore');

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
        const workspaces = findWorkspaces(currentDir);
        console.log('Workspaces:', workspaces);
        for (const dir of workspaces) {
            console.log('Processing workspace:', dir);
            extractAISection(dir);
        }
        console.log('AI development mode enabled');
    });

program
    .command('off')
    .description('Exit AI development mode')
    .action(() => {
        const currentDir = process.cwd();
        console.log('Current dir:', currentDir);
        const workspaces = findWorkspaces(currentDir);
        console.log('Workspaces:', workspaces);
        for (const dir of workspaces) {
            console.log('Processing workspace:', dir);
            mergeAISection(dir);
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
    .argument('[paths...]')
    .action((paths) => {
        gitAdd(paths);
    });

program.parse();
