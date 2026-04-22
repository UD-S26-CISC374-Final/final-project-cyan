import { EventBus } from "../event-bus";
import { BaseLevel } from "./base-level";

/**
 * Level 1 — "System Login"
 *
 * The detective needs to log into the terminal system.
 * The only way in is to call two_factor(name) to receive a PIN.
 * The player must print the result to submit their login attempt.
 *
 * Solution: print(two_factor(name))
 * Where name = "Code" is already initialized in the transcript.
 */
export class Level1 extends BaseLevel {
    constructor() {
        super("Level1");
    }

    create() {
        super.create();
        EventBus.emit("current-scene-ready", this);
    }

    protected getLevelData() {
        return {
            // Shown in the read-only transcript panel (top half of smartboard).
            // Written as Python comments + variable initialization.
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

            // The correct answer the printer output must match.
            // two_factor("Code") returns this PIN.
            correctAnswer: "PIN: 7429",

            // Function definitions — never shown to the player.
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
                        descriptions[funcName] ??
                        `No information found for '${funcName}'.`
                    );
                },
            },
        };
    }

    changeScene() {
        // Once Level 2 exists, change this to: this.scene.start("Level2")
        this.scene.start("GameOver");
    }
}
