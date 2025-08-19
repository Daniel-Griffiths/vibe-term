#!/usr/bin/env node

/**
 * Master generation script that runs all code generation scripts
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// List of generation scripts to run in order
const scripts = [
  'generate-communication-api.js',
  'generate-preload.js'
];

async function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running ${scriptName}...`);
    
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptName} completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${scriptName} failed with exit code ${code}`);
        reject(new Error(`Script ${scriptName} failed`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Error running ${scriptName}:`, error);
      reject(error);
    });
  });
}

async function main() {
  console.log('🔧 Running all code generation scripts...\n');
  
  try {
    for (const script of scripts) {
      await runScript(script);
    }
    
    console.log('\n🎉 All generation scripts completed successfully!');
  } catch (error) {
    console.error('\n💥 Generation failed:', error.message);
    process.exit(1);
  }
}

main();