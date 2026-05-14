import { EventBus } from "../event-bus";
import { BaseLevel } from "./base-level";
import type { LevelFunction } from "../python-executor";

/**
 * Level 1 — "System Login"
 *
 * The detective needs to log into the terminal system.
 * Solution: print(two_factor(name))
 * The PIN is randomized each time the level loads.
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
        // Generate a random 4-digit PIN each time the level loads
        const pin = String(Math.floor(1000 + Math.random() * 9000));

        return {
            transcript: [
                "# TUTORIAL: SYSTEM LOGIN",
                "# ----------------------",
                "# The terminal is locked. You need a PIN to log in.",
                "# Use two_factor() to receive your login PIN.",
                "",
                "# Run help() for more information.",
                "# Move your text cursor over the word 'help'",
                "# in the terminal, then click the telephone",
                "# to make a function phone call.",
                "",
                "# The line below shows a variable that can be used",
                "# like any other python variable",
                'name = "Code"',
                "",
                "# Print your 4-digit PIN below:",
                'print("Enter the 4-digit PIN: ")',
                "",
                "# Click the printer to see if your report is good",
            ].join("\n"),

            // Only the PIN itself needs to appear in the printed output
            correctAnswer: pin,

            initialTerminalLines: ["help()"],

            functions: {
                two_factor: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return {
                            dialogue:
                                "Authentication required.\n" +
                                "Call me with: two_factor(name)\n" +
                                "  name — your agent codename",
                            value: "",
                        };
                    }
                    const name = String(args[0]);
                    if (name === "Code") {
                        return {
                            dialogue:
                                `Identity confirmed, Agent Code.\n` +
                                `Your login PIN is: ${pin}`,
                            value: pin,
                        };
                    }
                    return {
                        dialogue: `Unknown agent: ${name}. Access denied.`,
                        value: "",
                    };
                },

                help: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return {
                            dialogue:
                                "SYSTEM LOGIN\n" +
                                "------------\n" +
                                "The terminal has been locked by the new robotic system.\n" +
                                "To regain access, you must verify your identity.\n" +
                                "\n" +
                                "Step 1: Call two_factor(name) using your agent codename\n" +
                                "        to receive your 4-digit PIN.\n" +
                                "Step 2: print() the PIN to submit it.\n" +
                                "\n" +
                                "Your codename is already loaded — check the variables above.\n" +
                                "Tip: use help('two_factor') to learn how that function works.",
                            value: "",
                        };
                    }
                    const funcName = String(args[0]);
                    const descriptions: Record<string, string> = {
                        two_factor:
                            "two_factor(name)\n" +
                            "Generates a two-factor authentication PIN.\n" +
                            "  name : str — your agent codename\n" +
                            "Returns a 4-digit PIN if the name is recognized.\n" +
                            "\n" +
                            "Example: two_factor(name)",
                        help:
                            "help(func_name?)\n" +
                            "With no arguments: shows the full case instructions.\n" +
                            "With a function name: describes that function.\n" +
                            "\n" +
                            "Example: help('two_factor')",
                    };
                    const desc =
                        descriptions[funcName] ??
                        `No information found for '${funcName}'.`;
                    return { dialogue: desc, value: "" };
                },

                inner: (
                    ...args: (string | number | boolean)[]
                ): { dialogue: string; value: string } => {
                    void args;
                    return {
                        dialogue: "This is the inner function.",
                        value: "3",
                    };
                },

                outer: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return {
                            dialogue: "This is the outer function.",
                            value: "",
                        };
                    }
                    const val = Number(args[0]);
                    if (!isNaN(val)) {
                        return {
                            dialogue: `Outer received ${val}, returning ${val + 1}.`,
                            value: String(val + 1),
                        };
                    }
                    return {
                        dialogue: "This is the outer function.",
                        value: "",
                    };
                },
            },
        };
    }

    changeScene() {
        this.scene.start("GameOver");
    }
}
