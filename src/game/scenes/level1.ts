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
                "# SYSTEM LOGIN REQUIRED",
                "# ----------------------",
                "# The terminal is locked. You need a PIN to log in.",
                "# Use two_factor() to receive your login PIN.",
                "# Print the result to submit your login attempt.",
                "#",
                "# Run help() for more information.",
                "#",
                'name = "Code"',
            ].join("\n"),

            correctAnswer: "PIN: 7429",

            initialTerminalLines: ["help()"],

            functions: {
                two_factor: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return (
                            "Authentication required.\n" +
                            "Call me with: two_factor(name)\n" +
                            "  name — your agent codename"
                        );
                    }
                    const name = String(args[0]);
                    if (name === "Code") return "PIN: 7429";
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
