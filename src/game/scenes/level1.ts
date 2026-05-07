import { EventBus } from "../event-bus";
import { BaseLevel } from "./base-level";
import type { LevelFunction } from "../python-executor";

/**
 * Level 1 — "System Login"
 *
 * The detective needs to log into the terminal system.
 * Solution: print(two_factor(name))
 * Where name = "Code" is already initialized in the transcript.
 *
 * Also includes outer(inner()) as a test case for nested function calls.
 */
export class Level1 extends BaseLevel {
    constructor() {
        super("Level1");
    }

    create() {
        super.create();

        this.createBackButton();

        EventBus.emit("current-scene-ready", this);
    }

    protected getLevelData(): {
        transcript: string;
        correctAnswer: string;
        functions: Record<string, LevelFunction>;
        initialTerminalLines?: string[];
    } {
        return {
            transcript: [
                "# TUTORIAL: SYSTEM LOGIN",
                "# ----------------------",
                "# The terminal is locked. You need a PIN to log in.",
                "# Use two_factor() to receive your login PIN.",
                "",
                "# Run help() for more information.",
                "# Move your text cursor over the word 'help' in the terminal",
                "# then click the telephone to make a function phone call.",
                "",
                "# The line below is a variable that can be used in a function call",
                'name = "Code"',
                "",
                "# Print your 4-digit PIN below:",
                'print("Enter the 4-digit PIN: ")',
                "",
            ].join("\n"),

            correctAnswer: "7429",

            initialTerminalLines: ["help()"],

            functions: {
                two_factor: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return (
                            "Authentication required.\n" +
                            "Call me with: two_factor(name)\n" +
                            "name — your agent codename"
                        );
                    }
                    const name = String(args[0]);
                    if (name === "Code") return "7429";
                    return `Unknown agent: ${name}. Access denied.`;
                },

                help: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return (
                            "SYSTEM LOGIN\n" +
                            "------------\n" +
                            "The terminal has been locked by the new robotic system.\n" +
                            "To regain access, you must verify your identity.\n" +
                            "\n" +
                            "Step 1: Call two_factor(detective_name) using your agent codename\n" +
                            "to receive your 4-digit PIN.\n" +
                            "Step 2: print() the PIN to submit it.\n" +
                            "\n" +
                            "Your codename is already loaded — check the variables above.\n" +
                            "Tip: You can put the function name into the argument of help() as a string \n" +
                            "For example: help('function_name')\n" +
                            "to learn more about how that function works.\n"
                        );
                    }
                    const funcName = String(args[0]);
                    const descriptions: Record<string, string> = {
                        two_factor:
                            "two_factor(name)\n" +
                            "Generates a two-factor authentication PIN.\n" +
                            "name : str — your agent codename\n" +
                            "Returns a 4-digit PIN if the name is recognized.\n",
                        help:
                            "help(func_name?)\n" +
                            "With no arguments: shows the full case instructions.\n" +
                            "With a function name: describes that function.\n" +
                            "\n" +
                            "Example: help('two_factor')",
                    };
                    return (
                        descriptions[funcName] ??
                        `No information found for '${funcName}'.`
                    );
                },

                // ── Nested call test functions ─────────────────────────────
                // These exist to test the telephone's cursor-based call logic.
                // outer(inner()) should return 4.
                // Cursor over "inner" → calls inner(), shows "this is the inner function", returns 3
                // Cursor over "outer" → resolves inner() first, then calls outer(3), returns 4

                inner: (...args: (string | number | boolean)[]): string => {
                    void args;
                    return "this is the inner function";
                },

                outer: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return "this is the outer function";
                    }
                    // If given the result of inner() as a number, increment it
                    const val = Number(args[0]);
                    if (!isNaN(val)) {
                        return String(val + 1);
                    }
                    return "this is the outer function";
                },
            },
        };
    }

    changeScene() {
        this.scene.start("GameOver");
    }
}
