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

        const { height } = this.scale;

        // 左下角按钮
        const backButton = this.add
            .text(20, height - 20, "← Menu", {
                fontFamily: "Arial Black",
                fontSize: 20,
                color: "#111111",
                backgroundColor: "#f5d742",
                padding: { x: 12, y: 6 },
            })
            .setOrigin(0, 1)
            .setInteractive({ useHandCursor: true })
            .setDepth(1000);

        // 悬停效果
        backButton.on("pointerover", () => {
            backButton.setStyle({ backgroundColor: "#ffe066" });
        });

        backButton.on("pointerout", () => {
            backButton.setStyle({ backgroundColor: "#f5d742" });
        });

        // 点击 → 弹确认框
        backButton.on("pointerdown", () => {
            this.showConfirmDialog();
        });

        EventBus.emit("current-scene-ready", this);
    }
    private showConfirmDialog() {
        const { width, height } = this.scale;

        // 半透明遮罩
        const overlay = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.6)
            .setOrigin(0)
            .setDepth(2000);

        // 弹窗背景
        const box = this.add
            .rectangle(width / 2, height / 2, 400, 200, 0x222222)
            .setStrokeStyle(2, 0xf5d742)
            .setDepth(2001);

        // 提示文字
        const text = this.add
            .text(width / 2, height / 2 - 40, "Return to Main Menu?", {
                fontFamily: "Arial",
                fontSize: 22,
                color: "#ffffff",
            })
            .setOrigin(0.5)
            .setDepth(2002);

        //YES 按钮
        const yesBtn = this.add
            .text(width / 2 - 80, height / 2 + 40, "Yes", {
                fontSize: 20,
                color: "#111111",
                backgroundColor: "#f5d742",
                padding: { x: 15, y: 8 },
            })
            .setOrigin(0.5)
            .setInteractive()
            .setDepth(2002);

        //NO 按钮
        const noBtn = this.add
            .text(width / 2 + 80, height / 2 + 40, "No", {
                fontSize: 20,
                color: "#ffffff",
                backgroundColor: "#444444",
                padding: { x: 15, y: 8 },
            })
            .setOrigin(0.5)
            .setInteractive()
            .setDepth(2002);

        // YES → 返回主菜单
        yesBtn.on("pointerdown", () => {
            this.scene.start("MainMenu");
        });

        // NO → 关闭弹窗
        noBtn.on("pointerdown", () => {
            overlay.destroy();
            box.destroy();
            text.destroy();
            yesBtn.destroy();
            noBtn.destroy();
        });
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
