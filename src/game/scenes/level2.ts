import { EventBus } from "../event-bus";
import { BaseLevel } from "./base-level";
import type { LevelFunction } from "../python-executor";

export class Level2 extends BaseLevel {
    constructor() {
        super("Level2");
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
                "# ENCRYPTED MESSAGE",
                "# -----------------",
                "# A locked file was found on the suspect's terminal.",
                "# The message is encrypted.",
                "# You need to inspect the clue first to find the key.",
                "# Then decrypt the code with that key.",
                "#",
                "# Run help() for more information.",
                "#",
                'code = "XJ-91"',
                'clue = "matchbook"',
            ].join("\n"),

            correctAnswer: "MEET AT MIDNIGHT",

            initialTerminalLines: ["help()"],

            functions: {
                inspect: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return {
                            dialogue: "Inspect what? Try: inspect(clue)",
                            value: "",
                        };
                    }

                    const item = String(args[0]);

                    if (item === "matchbook") {
                        return {
                            dialogue:
                                "You flip open the matchbook. Scrawled inside\n" +
                                "the cover is a single word: 'silver-key'.",
                            value: "silver-key",
                        };
                    }

                    return {
                        dialogue: `Nothing useful found on ${item}.`,
                        value: "",
                    };
                },

                decrypt: (...args: (string | number | boolean)[]) => {
                    if (args.length < 2) {
                        return {
                            dialogue:
                                "Missing information.\n" +
                                "Call me with: decrypt(code, key)",
                            value: "",
                        };
                    }

                    const code = String(args[0]);
                    const key = String(args[1]);

                    if (code === "XJ-91" && key === "silver-key") {
                        return {
                            dialogue:
                                "Decryption successful.\n" +
                                "The message reads: MEET AT MIDNIGHT",
                            value: "MEET AT MIDNIGHT",
                        };
                    }

                    return {
                        dialogue: "Decryption failed. Wrong code or key.",
                        value: "",
                    };
                },

                help: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return {
                            dialogue:
                                "ENCRYPTED MESSAGE\n" +
                                "-----------------\n" +
                                "The encrypted file needs both a code and a key.\n" +
                                "First inspect the clue to find the key.\n" +
                                "Then use decrypt(code, key).\n" +
                                "Finally print() the decrypted message.\n" +
                                "\n" +
                                "Hint: try inspect(clue).",
                            value: "",
                        };
                    }

                    const funcName = String(args[0]);

                    const descriptions: Record<string, string> = {
                        inspect:
                            "inspect(item)\n" +
                            "Examines an object for hidden information.\n" +
                            "Returns a key if the item contains one.",
                        decrypt:
                            "decrypt(code, key)\n" +
                            "Decrypts a locked message.\n" +
                            "Requires both the encrypted code and the correct key.",
                        help:
                            "help(func_name?)\n" +
                            "With no arguments: shows level instructions.\n" +
                            "With a function name: describes that function.",
                    };

                    const desc =
                        descriptions[funcName] ??
                        `No information found for '${funcName}'.`;
                    return { dialogue: desc, value: "" };
                },
            },
        };
    }

    changeScene() {
        this.scene.start("GameOver");
    }
}
