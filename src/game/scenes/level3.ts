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
                "#",
                "# First scan the badge.",
                "# Then verify the agent.",
                "# Finally use unlock() with both results.",
                "#",
                "# Run help() for more information.",
                "#",
                'badge = "detective-badge"',
                'agent = "Code"',
            ].join("\n"),

            correctAnswer: "ACCESS GRANTED",

            initialTerminalLines: ["help()"],

            functions: {
                scan: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return "Scan what? Try: scan(badge)";
                    }

                    const item = String(args[0]);

                    if (item === "detective-badge") {
                        return "BADGE-OK";
                    }

                    return `Scan failed: ${item}`;
                },

                verify: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return "Verify who? Try: verify(agent)";
                    }

                    const name = String(args[0]);

                    if (name === "Code") {
                        return "AGENT-OK";
                    }

                    return `Unknown agent: ${name}`;
                },

                unlock: (...args: (string | number | boolean)[]) => {
                    if (args.length < 2) {
                        return (
                            "Missing access tokens.\n" +
                            "Call me with: unlock(badge_token, agent_token)"
                        );
                    }

                    const badgeToken = String(args[0]);
                    const agentToken = String(args[1]);

                    if (
                        badgeToken === "BADGE-OK" &&
                        agentToken === "AGENT-OK"
                    ) {
                        return "ACCESS GRANTED";
                    }

                    return "ACCESS DENIED";
                },

                help: (...args: (string | number | boolean)[]) => {
                    if (args.length === 0) {
                        return (
                            "FINAL ACCESS\n" +
                            "------------\n" +
                            "The final door requires two tokens.\n" +
                            "Use scan(badge) to get the badge token.\n" +
                            "Use verify(agent) to get the agent token.\n" +
                            "Then use unlock(token1, token2).\n" +
                            "Finally print() the result.\n" +
                            "\n" +
                            "Hint: nested calls can solve this in one line."
                        );
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

                    return (
                        descriptions[funcName] ??
                        `No information found for '${funcName}'.`
                    );
                },
            },
        };
    }

    changeScene() {
        this.scene.start("GameOver");
    }
}
