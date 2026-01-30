/**
 * Test Runner for Workout Tracker
 * Uses Node.js built-in test runner (node:test)
 */

import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    dim: '\x1b[2m'
};

/**
 * Simple test framework
 */
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.skipped = 0;
    }

    describe(name, fn) {
        console.log(`\n${colors.blue}● ${name}${colors.reset}`);
        fn();
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    skip(name) {
        this.tests.push({ name, skip: true });
    }

    async run() {
        for (const { name, fn, skip } of this.tests) {
            if (skip) {
                console.log(`  ${colors.yellow}○ SKIP${colors.reset} ${name}`);
                this.skipped++;
                continue;
            }

            try {
                await fn();
                console.log(`  ${colors.green}✓ PASS${colors.reset} ${name}`);
                this.passed++;
            } catch (error) {
                console.log(`  ${colors.red}✗ FAIL${colors.reset} ${name}`);
                console.log(`    ${colors.dim}${error.message}${colors.reset}`);
                this.failed++;
            }
        }
        this.tests = [];
    }

    summary() {
        console.log('\n' + '─'.repeat(50));
        console.log(`${colors.green}Passed: ${this.passed}${colors.reset}`);
        if (this.failed > 0) {
            console.log(`${colors.red}Failed: ${this.failed}${colors.reset}`);
        }
        if (this.skipped > 0) {
            console.log(`${colors.yellow}Skipped: ${this.skipped}${colors.reset}`);
        }
        console.log('─'.repeat(50));
        return this.failed === 0;
    }
}

/**
 * Assertion helpers
 */
export function assert(condition, message = 'Assertion failed') {
    if (!condition) {
        throw new Error(message);
    }
}

export function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

export function assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`);
    }
}

export function assertThrows(fn, message) {
    let threw = false;
    try {
        fn();
    } catch (e) {
        threw = true;
    }
    if (!threw) {
        throw new Error(message || 'Expected function to throw');
    }
}

export function assertApproxEqual(actual, expected, tolerance = 0.01, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(message || `Expected ~${expected}, got ${actual}`);
    }
}

// Global test runner instance
export const runner = new TestRunner();
export const describe = runner.describe.bind(runner);
export const test = runner.test.bind(runner);
export const skip = runner.skip.bind(runner);

/**
 * Main entry point
 */
async function main() {
    const args = process.argv.slice(2);
    const filter = args[0]; // 'unit' or 'integration' or undefined for all

    console.log(`\n${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}  Workout Tracker Test Suite${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);

    const testFiles = [];

    // Find unit tests
    if (!filter || filter === 'unit') {
        try {
            const unitFiles = await readdir(__dirname);
            for (const file of unitFiles) {
                if (file.endsWith('.test.js')) {
                    testFiles.push(join(__dirname, file));
                }
            }
        } catch (e) {
            // No unit tests
        }
    }

    // Find integration tests
    if (!filter || filter === 'integration') {
        try {
            const integrationDir = join(__dirname, 'integration');
            const integrationFiles = await readdir(integrationDir);
            for (const file of integrationFiles) {
                if (file.endsWith('.test.js')) {
                    testFiles.push(join(integrationDir, file));
                }
            }
        } catch (e) {
            // No integration tests
        }
    }

    if (testFiles.length === 0) {
        console.log(`\n${colors.yellow}No test files found.${colors.reset}`);
        process.exit(0);
    }

    console.log(`\nRunning ${testFiles.length} test file(s)...`);

    // Import and run each test file
    for (const file of testFiles) {
        try {
            await import(file);
            await runner.run();
        } catch (error) {
            console.error(`${colors.red}Error loading ${file}:${colors.reset}`, error.message);
        }
    }

    const success = runner.summary();
    process.exit(success ? 0 : 1);
}

main().catch(console.error);
