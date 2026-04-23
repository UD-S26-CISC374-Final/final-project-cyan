/**
 * python-executor-test.ts
 *
 * Standalone test for PythonExecutor using the Level 1 PIN puzzle.
 * Run with: npx ts-node src/game/python-executor-test.ts
 *
 * Tests cover:
 *   1. Transcript loading (variable initialization)
 *   2. help() with no arguments
 *   3. help(two_factor) — function description
 *   4. two_factor() with no arguments — usage hint
 *   5. two_factor(name) — correct call using transcript variable
 *   6. print(two_factor(name)) — the correct solution
 *   7. print(two_factor("Wrong")) — wrong name, should deny access
 *   8. two_factor(name) called with unknown variable — should error
 *   9. String concatenation
 *  10. Full runAll() simulating the printer
 */

import { PythonExecutor } from "./python-executor";
import type { LevelFunction } from "./python-executor";

// ── Level 1 function definitions (copied from level1.ts) ──────────────────────
const level1Functions: Record<string, LevelFunction> = {
    two_factor: (...args: (string | number | boolean)[]) => {
        if (args.length === 0) {
            return (
                "Authentication required.\n" +
                "Call me with: two_factor(name)\n" +
                "  name — your agent codename"
            );
        }
        const name = String(args[0]);
        if (name === "Code") {
            return "PIN: 7429";
        }
        return `Unknown agent: ${name}. Access denied.`;
    },

    help: (...args: (string | number | boolean)[]) => {
        if (args.length === 0) {
            return (
                "SYSTEM LOGIN\n" +
                "------------\n" +
                "The terminal has been locked by the new robotic system.\n" +
                "To regain access, you must verify your identity.\n" +
                "Call two_factor(name) using your agent codename,\n" +
                "then print() the result to submit your login PIN.\n" +
                "\n" +
                "Your codename has already been loaded into the system.\n" +
                "Hint: check the initialized variables above."
            );
        }
        const funcName = String(args[0]);
        const descriptions: Record<string, string> = {
            two_factor:
                "two_factor(name)\n" +
                "Generates a two-factor authentication PIN.\n" +
                "  name : str — your agent codename\n" +
                "Returns a PIN string if the name is recognized.",
            help:
                "help(func_name?)\n" +
                "With no arguments: shows the full case transcript.\n" +
                "With a function name: describes that function.",
        };
        return (
            descriptions[funcName] ?? `No information found for '${funcName}'.`
        );
    },
};

// ── Transcript (copied from level1.ts) ────────────────────────────────────────
const transcript = [
    "# SYSTEM LOGIN REQUIRED",
    "# ----------------------",
    "# The terminal is locked. You need a PIN to log in.",
    "# Use two_factor() to receive your login PIN.",
    "# Print the result to submit your login attempt.",
    "#",
    "# Run help() for more information.",
    "#",
    'name = "Code"',
].join("\n");

// ── Test runner helpers ───────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(description: string, actual: string, expected: string) {
    if (actual === expected) {
        console.log(`  ✅ PASS: ${description}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${description}`);
        console.log(`       Expected: ${JSON.stringify(expected)}`);
        console.log(`       Actual:   ${JSON.stringify(actual)}`);
        failed++;
    }
}

// ── Run tests ─────────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════");
console.log("  Detective Code — PythonExecutor Test Suite");
console.log("═══════════════════════════════════════════════\n");

const executor = new PythonExecutor(level1Functions);
executor.loadTranscript(transcript);

// 1. Transcript variable loaded correctly
console.log("── Test 1: Transcript variable loading ──");
const varTest = executor.runLine("two_factor(name)");
test('name resolves to "Code" via transcript', varTest.output, "PIN: 7429");

// 2. help() with no arguments
console.log("\n── Test 2: help() with no arguments ──");
const helpNoArgs = executor.runLine("help()");
test("help() returns full transcript", helpNoArgs.type, "call");
test(
    "help() output contains SYSTEM LOGIN",
    helpNoArgs.output.includes("SYSTEM LOGIN") ? "yes" : "no",
    "yes",
);

// 3. help(two_factor) — function description
console.log("\n── Test 3: help(two_factor) ──");
const helpFunc = executor.runLine('help("two_factor")');
test(
    "help(two_factor) returns function description",
    helpFunc.output.includes("two_factor(name)") ? "yes" : "no",
    "yes",
);

// 4. two_factor() with no arguments — usage hint
console.log("\n── Test 4: two_factor() with no arguments ──");
const noArgs = executor.runLine("two_factor()");
test(
    "two_factor() returns usage hint",
    noArgs.output.includes("Authentication required") ? "yes" : "no",
    "yes",
);

// 5. two_factor(name) — correct call using transcript variable
console.log("\n── Test 5: two_factor(name) ──");
const correctCall = executor.runLine("two_factor(name)");
test("two_factor(name) returns PIN", correctCall.output, "PIN: 7429");
test("result type is call", correctCall.type, "call");

// 6. print(two_factor(name)) — the correct solution
console.log("\n── Test 6: print(two_factor(name)) — correct solution ──");
executor.reset();
const solution = executor.runLine("print(two_factor(name))");
test("print(two_factor(name)) type is print", solution.type, "print");
test(
    "print(two_factor(name)) printed value is PIN",
    solution.printedValue,
    "PIN: 7429",
);
test("getPrintOutput() returns PIN", executor.getPrintOutput(), "PIN: 7429");

// 7. Wrong name — access denied
console.log('\n── Test 7: two_factor("Wrong") ──');
const wrongName = executor.runLine('two_factor("Wrong")');
test(
    "wrong name returns access denied",
    wrongName.output.includes("Access denied") ? "yes" : "no",
    "yes",
);

// 8. Unknown variable — should error
console.log("\n── Test 8: unknown variable ──");
const unknownVar = executor.runLine("two_factor(ghost)");
test("unknown variable returns error type", unknownVar.type, "error");

// 9. String concatenation
console.log("\n── Test 9: string concatenation ──");
executor.reset();
executor.runLine('prefix = "Agent: "');
const concat = executor.runLine('print("Agent: " + name)');
test(
    'string concatenation "Agent: " + name',
    concat.printedValue,
    "Agent: Code",
);

// 10. Full runAll() — simulates the printer running the complete program
console.log("\n── Test 10: runAll() — full program simulation ──");
executor.reset();
const fullProgram = ["# This is the solution", "print(two_factor(name))"].join(
    "\n",
);
executor.runAll(fullProgram);
test(
    "runAll() produces correct print output",
    executor.getPrintOutput(),
    "PIN: 7429",
);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════\n");
