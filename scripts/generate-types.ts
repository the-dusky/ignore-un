import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SRC_DIR = path.join(process.cwd(), 'src');
const TYPES_FILE = path.join(SRC_DIR, 'generated', 'shell-types.ts');

// Function to extract function names and parameters from shell scripts
function extractFunctions(scriptPath: string): any[] {
  const content = fs.readFileSync(scriptPath, 'utf-8');
  const functions: any[] = [];
  
  // Match function declarations
  const functionRegex = /^(\w+)\(\)\s*{/gm;
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const functionName = match[1];
    
    // Find the function body
    const startIndex = match.index;
    let braceCount = 1;
    let endIndex = startIndex;
    
    for (let i = content.indexOf('{', startIndex); i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0) {
        endIndex = i;
        break;
      }
    }
    
    const functionBody = content.slice(startIndex, endIndex + 1);
    
    // Extract parameters from local variable declarations
    const paramRegex = /local\s+(\w+)=/g;
    const params = [];
    let paramMatch;
    
    while ((paramMatch = paramRegex.exec(functionBody)) !== null) {
      params.push(paramMatch[1]);
    }
    
    functions.push({
      name: functionName,
      params
    });
  }
  
  return functions;
}

// Generate TypeScript types
function generateTypes(functions: any[]): string {
  let output = `// Generated by scripts/generate-types.ts
// DO NOT EDIT DIRECTLY

export interface ShellFunctions {
`;
  
  for (const func of functions) {
    output += `  ${func.name}: (${func.params.map((p: string) => `${p}: string`).join(', ')}) => void;\n`;
  }
  
  output += '}\n\n';
  
  // Add specific types for each function
  for (const func of functions) {
    output += `export type ${func.name}Params = {
  ${func.params.map((p: string) => `${p}: string`).join(';\n  ')};
};\n\n`;
  }
  
  return output;
}

// Main execution
console.log('Generating types from shell scripts...');

// Ensure output directory exists
fs.mkdirSync(path.dirname(TYPES_FILE), { recursive: true });

// Get all shell scripts
const shellScripts = fs.readdirSync(SRC_DIR)
  .filter(file => file.endsWith('.sh'))
  .map(file => path.join(SRC_DIR, file));

// Extract functions and generate types
const allFunctions = shellScripts.flatMap(script => extractFunctions(script));
const typeContent = generateTypes(allFunctions);

// Write types file
fs.writeFileSync(TYPES_FILE, typeContent);

console.log(`Types written to ${path.relative(process.cwd(), TYPES_FILE)}`);

// Format the generated file
execSync(`yarn prettier --write "${TYPES_FILE}"`);
