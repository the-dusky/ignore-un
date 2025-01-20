#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const gitignore_js_1 = require("./gitignore.js");
const program = new commander_1.Command();
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
    const workspaces = (0, gitignore_js_1.findWorkspaces)(currentDir);
    console.log('Workspaces:', workspaces);
    for (const dir of workspaces) {
        (0, gitignore_js_1.extractAISection)(dir);
    }
});
program
    .command('off')
    .description('Exit AI development mode')
    .action(() => {
    const currentDir = process.cwd();
    const workspaces = (0, gitignore_js_1.findWorkspaces)(currentDir);
    for (const dir of workspaces) {
        if ((0, gitignore_js_1.isAIModeEnabled)(dir)) {
            (0, gitignore_js_1.mergeAISection)(dir);
        }
    }
});
program
    .argument('[files...]')
    .description('Add files while respecting AI patterns')
    .action((files) => {
    (0, gitignore_js_1.gitAdd)(files);
});
program.parse();
