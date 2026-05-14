import { EventBus } from "../event-bus";
import { BaseLevel } from "./base-level";
import type { LevelFunction } from "../python-executor";

/**
 * Level 3 — "Final Access"
 *
 * Solution:
 * print(unlock(scan(badge), verify(agent)))
 */
export class Level3 extends BaseLevel {
    constructor() {
        super("Level3");
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
                "# FINAL ACCESS",
                "# ------------",
                "# The final door is locked.",
                "# You need two access tokens to open it.",
                "",
                "# First scan the badge.",
                "# Then verify the agent.",
                "# Finally use unlock() with both results.",
                "",
                "# Run help() for more information.",
                "",
                'badge = "detective-badge"',
                'agent = "Code"',
            ].join("\n"),

            correctAnswer: "ACCESS GRANTED",

            initialTerminalLines: ["help()"],

            functions: {
                scan: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return {
                            dialogue: "Scan what? Try: scan(badge)",
                            value: "",
                        };
                    }

                    const item = String(args[0]);

                    if (item === "detective-badge") {
                        return {
                            dialogue:
                                "Badge scan complete.\n" +
                                "Security token found: BADGE-OK",
                            value: "BADGE-OK",
                        };
                    }

                    return {
                        dialogue: `Scan failed: ${item}`,
                        value: "",
                    };
                },

                verify: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return {
                            dialogue: "Verify who? Try: verify(agent)",
                            value: "",
                        };
                    }

                    const name = String(args[0]);

                    if (name === "Code") {
                        return {
                            dialogue:
                                "Agent identity verified.\n" +
                                "Authorization token found: AGENT-OK",
                            value: "AGENT-OK",
                        };
                    }

                    return {
                        dialogue: `Unknown agent: ${name}`,
                        value: "",
                    };
                },

                unlock: (...args: (string | number | boolean)[]) => {
                    if (args.length < 2) {
                        return {
                            dialogue:
                                "Missing access tokens.\n" +
                                "Call me with: unlock(badge_token, agent_token)",
                            value: "",
                        };
                    }

                    const badgeToken = String(args[0]);
                    const agentToken = String(args[1]);

                    if (
                        badgeToken === "BADGE-OK" &&
                        agentToken === "AGENT-OK"
                    ) {
                        return {
                            dialogue: "Final lock opened.\n" + "ACCESS GRANTED",
                            value: "ACCESS GRANTED",
                        };
                    }

                    return {
                        dialogue: "ACCESS DENIED",
                        value: "",
                    };
                },

                help: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return {
                            dialogue:
                                "FINAL ACCESS\n" +
                                "------------\n" +
                                "The final door requires two tokens.\n" +
                                "Use scan(badge) to get the badge token.\n" +
                                "Use verify(agent) to get the agent token.\n" +
                                "Then use unlock(token1, token2).\n" +
                                "Finally print() the result.\n" +
                                "\n" +
                                "Hint: nested calls can solve this in one line.",
                            value: "",
                        };
                    }

                    const funcName = String(args[0]);

                    const descriptions: Record<string, string> = {
                        scan:
                            "scan(item)\n" +
                            "Scans an item and returns a badge token if valid.",
                        verify:
                            "verify(agent)\n" +
                            "Verifies an agent name and returns an agent token.",
                        unlock:
                            "unlock(badge_token, agent_token)\n" +
                            "Unlocks the final door when both tokens are correct.",
                        help:
                            "help(func_name?)\n" +
                            "With no arguments: shows final level instructions.\n" +
                            "With a function name: describes that function.",
                    };

                    const desc =
                        descriptions[funcName] ??
                        `No information found for '${funcName}'.`;

                    return {
                        dialogue: desc,
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
