import { Scene, GameObjects } from "phaser";
import { EventBus } from "../event-bus";

/**
 * BaseLevel defines the shared layout and interactivity for all game levels.
 *
 * Layout:
 *   - Smartboard (top-left)  : transcript (read-only) + terminal (editable)
 *   - Blackboard (top-right) : function trace table (auto-filled)
 *   - Desk (bottom)          : spans full width
 *   - Keyboard (desk-left)   : activates terminal
 *   - Telephone (desk-center): shows word bubble for current function call
 *   - Printer (desk-right)   : runs program and shows report
 *
 * Overlays:
 *   - Word bubble  : appears above telephone, tail always points to telephone world pos
 *   - Report panel : appears top-right, horizontal-drag only, red X closes it
 *   - Hint box     : appears at bottom, red X closes it independently
 *   - Continue arrow: appears top-left on correct answer
 */
export abstract class BaseLevel extends Scene {
    // ── Canvas ────────────────────────────────────────────────────────────────
    protected readonly W = 1024;
    protected readonly H = 768;

    // ── Desk ──────────────────────────────────────────────────────────────────
    protected readonly DESK_X = 0;
    protected readonly DESK_Y = 560;
    protected readonly DESK_W = 1024;
    protected readonly DESK_H = 208;

    // ── Smartboard (top-left) ─────────────────────────────────────────────────
    protected readonly SB_X = 10;
    protected readonly SB_Y = 10;
    protected readonly SB_W = 500;
    protected readonly SB_H = 540;
    protected readonly TRANSCRIPT_H = 240;
    protected readonly TERMINAL_Y = this.SB_Y + this.TRANSCRIPT_H + 4;
    protected readonly TERMINAL_H = this.SB_H - this.TRANSCRIPT_H - 4;

    // ── Blackboard (top-right) ────────────────────────────────────────────────
    protected readonly BB_X = 520;
    protected readonly BB_Y = 10;
    protected readonly BB_W = 494;
    protected readonly BB_H = 540;

    // ── Desk items ────────────────────────────────────────────────────────────
    protected readonly ITEM_Y = this.DESK_Y + 20;
    protected readonly ITEM_H = 120;
    protected readonly ITEM_W = 200;
    protected readonly KEYBOARD_X = 100;
    protected readonly PHONE_X = 412;
    protected readonly PRINTER_X = 724;

    // Telephone world-center X — the tail tip always points here
    protected readonly PHONE_CENTER_X = this.PHONE_X + this.ITEM_W / 2;
    protected readonly PHONE_CENTER_Y = this.ITEM_Y + this.ITEM_H / 2;

    // ── Word bubble ───────────────────────────────────────────────────────────
    protected readonly BUBBLE_W = 380;
    protected readonly BUBBLE_H = 220;
    protected readonly BUBBLE_TAIL_H = 40;
    protected readonly BUBBLE_DEFAULT_X = 520; // container left edge (world)
    protected readonly BUBBLE_Y = 290; // container top edge (world)

    // ── Report panel ──────────────────────────────────────────────────────────
    protected readonly REPORT_W = 340;
    protected readonly REPORT_H = 300;
    protected readonly REPORT_DEFAULT_X = 660;
    protected readonly REPORT_Y = 30;

    // ── Hint box ──────────────────────────────────────────────────────────────
    protected readonly HINT_Y = 630;
    protected readonly HINT_H = 90;

    // ── Terminal typing state ─────────────────────────────────────────────────
    protected terminalLines: string[] = [""]; // lines of text the player has typed
    protected terminalCursorLine = 0; // which line the cursor is on
    protected terminalActive = false; // whether the terminal has focus

    // ── Layout objects ────────────────────────────────────────────────────────
    protected desk!: GameObjects.Rectangle;
    protected smartboard!: GameObjects.Rectangle;
    protected transcriptPanel!: GameObjects.Rectangle;
    protected transcriptLabel!: GameObjects.Text;
    protected terminalPanel!: GameObjects.Rectangle;
    protected terminalText!: GameObjects.Text; // shows live typed content + cursor
    protected blackboard!: GameObjects.Rectangle;
    protected blackboardLabel!: GameObjects.Text;
    protected keyboard!: GameObjects.Rectangle;
    protected keyboardLabel!: GameObjects.Text;
    protected telephone!: GameObjects.Rectangle;
    protected telephoneLabel!: GameObjects.Text;
    protected printer!: GameObjects.Rectangle;
    protected printerLabel!: GameObjects.Text;

    // ── Word bubble objects ───────────────────────────────────────────────────
    protected bubbleContainer!: GameObjects.Container;
    protected bubbleBody!: GameObjects.Rectangle;
    protected bubbleText!: GameObjects.Text;
    protected bubbleTailGraphic!: GameObjects.Graphics;

    // ── Report panel objects ──────────────────────────────────────────────────
    protected reportContainer!: GameObjects.Container;
    protected reportBody!: GameObjects.Rectangle;
    protected reportText!: GameObjects.Text;
    protected reportCloseBtn!: GameObjects.Text;

    // ── Hint box objects ──────────────────────────────────────────────────────
    protected hintContainer!: GameObjects.Container;
    protected hintBody!: GameObjects.Rectangle;
    protected hintText!: GameObjects.Text;
    protected hintCloseBtn!: GameObjects.Text;

    // ── Continue arrow ────────────────────────────────────────────────────────
    protected continueArrow!: GameObjects.Container;

    // ── State ─────────────────────────────────────────────────────────────────
    protected activeAction: "terminal" | "telephone" | "printer" | null = null;

    // Drag state
    private dragTarget: GameObjects.Container | null = null;
    private dragOffsetX = 0;

    // Cursor blink timer
    private cursorVisible = true;
    private cursorTimer = 0;
    private readonly CURSOR_BLINK_MS = 530;

    // ── Abstract ──────────────────────────────────────────────────────────────
    protected abstract getLevelData(): {
        transcript: string;
        correctAnswer: string;
        functions: Record<
            string,
            (...args: (string | number | boolean)[]) => string
        >;
    };

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    create() {
        this.buildLayout();
        this.buildWordBubble();
        this.buildReportPanel();
        this.buildHintBox();
        this.buildContinueArrow();
        this.setupInteractions();
        this.setupDragListeners();
        this.setupKeyboardInput();
        EventBus.emit("current-scene-ready", this);
    }

    update(_time: number, delta: number) {
        // Blink the cursor when terminal is active
        if (this.terminalActive) {
            this.cursorTimer += delta;
            if (this.cursorTimer >= this.CURSOR_BLINK_MS) {
                this.cursorTimer = 0;
                this.cursorVisible = !this.cursorVisible;
                this.refreshTerminalDisplay();
            }
        }
    }

    // ── Layout ────────────────────────────────────────────────────────────────
    private buildLayout() {
        // Desk
        this.desk = this.add
            .rectangle(
                this.DESK_X + this.DESK_W / 2,
                this.DESK_Y + this.DESK_H / 2,
                this.DESK_W,
                this.DESK_H,
                0x8b4513,
            )
            .setStrokeStyle(4, 0x5c2d0a);

        // Smartboard frame
        this.smartboard = this.add
            .rectangle(
                this.SB_X + this.SB_W / 2,
                this.SB_Y + this.SB_H / 2,
                this.SB_W,
                this.SB_H,
                0x1a1a2e,
            )
            .setStrokeStyle(4, 0x4a9eff);

        // Transcript (read-only top half)
        this.transcriptPanel = this.add
            .rectangle(
                this.SB_X + this.SB_W / 2,
                this.SB_Y + this.TRANSCRIPT_H / 2,
                this.SB_W - 8,
                this.TRANSCRIPT_H - 4,
                0x0d1b2a,
            )
            .setStrokeStyle(2, 0x2a5c8a);

        this.transcriptLabel = this.add
            .text(
                this.SB_X + 12,
                this.SB_Y + 10,
                "SMARTBOARD — TRANSCRIPT (read-only)",
                {
                    fontFamily: "Courier New",
                    fontSize: "12px",
                    color: "#4a9eff",
                },
            )
            .setOrigin(0, 0);

        // Terminal (editable bottom half) — shows typed text + blinking cursor
        this.terminalPanel = this.add
            .rectangle(
                this.SB_X + this.SB_W / 2,
                this.TERMINAL_Y + this.TERMINAL_H / 2,
                this.SB_W - 8,
                this.TERMINAL_H - 4,
                0x0a120a,
            )
            .setStrokeStyle(2, 0x39ff14);

        this.terminalText = this.add
            .text(this.SB_X + 12, this.TERMINAL_Y + 10, "", {
                fontFamily: "Courier New",
                fontSize: "14px",
                color: "#39ff14",
                wordWrap: { width: this.SB_W - 28 },
            })
            .setOrigin(0, 0);

        // Blackboard
        this.blackboard = this.add
            .rectangle(
                this.BB_X + this.BB_W / 2,
                this.BB_Y + this.BB_H / 2,
                this.BB_W,
                this.BB_H,
                0x2d5a1b,
            )
            .setStrokeStyle(4, 0x8b6914);

        this.blackboardLabel = this.add
            .text(
                this.BB_X + this.BB_W / 2,
                this.BB_Y + 12,
                "BLACKBOARD — Function Trace Table",
                {
                    fontFamily: "Courier New",
                    fontSize: "13px",
                    color: "#e8f5e1",
                    align: "center",
                },
            )
            .setOrigin(0.5, 0);

        const y = this.ITEM_Y;
        const h = this.ITEM_H;
        const w = this.ITEM_W;

        // Keyboard
        this.keyboard = this.add
            .rectangle(this.KEYBOARD_X + w / 2, y + h / 2, w, h, 0x2c3e6b)
            .setStrokeStyle(3, 0x7799ff)
            .setInteractive({ useHandCursor: true });
        this.keyboardLabel = this.add
            .text(
                this.KEYBOARD_X + w / 2,
                y + h / 2,
                "KEYBOARD\n(click to type)",
                {
                    fontFamily: "Courier New",
                    fontSize: "13px",
                    color: "#ccd9ff",
                    align: "center",
                },
            )
            .setOrigin(0.5);

        // Telephone
        this.telephone = this.add
            .rectangle(this.PHONE_X + w / 2, y + h / 2, w, h, 0x8b0000)
            .setStrokeStyle(3, 0xff4444)
            .setInteractive({ useHandCursor: true });
        this.telephoneLabel = this.add
            .text(
                this.PHONE_X + w / 2,
                y + h / 2,
                "TELEPHONE\n(click to call)",
                {
                    fontFamily: "Courier New",
                    fontSize: "13px",
                    color: "#ffcccc",
                    align: "center",
                },
            )
            .setOrigin(0.5);

        // Printer
        this.printer = this.add
            .rectangle(this.PRINTER_X + w / 2, y + h / 2, w, h, 0x1a4a1a)
            .setStrokeStyle(3, 0x44ff44)
            .setInteractive({ useHandCursor: true });
        this.printerLabel = this.add
            .text(
                this.PRINTER_X + w / 2,
                y + h / 2,
                "PRINTER\n(click to print)",
                {
                    fontFamily: "Courier New",
                    fontSize: "13px",
                    color: "#ccffcc",
                    align: "center",
                },
            )
            .setOrigin(0.5);
    }

    // ── Word bubble ───────────────────────────────────────────────────────────
    private buildWordBubble() {
        this.bubbleContainer = this.add.container(
            this.BUBBLE_DEFAULT_X,
            this.BUBBLE_Y,
        );

        this.bubbleBody = this.add
            .rectangle(
                this.BUBBLE_W / 2,
                this.BUBBLE_H / 2,
                this.BUBBLE_W,
                this.BUBBLE_H,
                0xd0d0d0,
            )
            .setStrokeStyle(3, 0x888888)
            .setOrigin(0.5);

        this.bubbleTailGraphic = this.add.graphics();

        this.bubbleText = this.add
            .text(12, 12, "(telephone response will appear here)", {
                fontFamily: "Courier New",
                fontSize: "13px",
                color: "#222222",
                wordWrap: { width: this.BUBBLE_W - 24 },
            })
            .setOrigin(0, 0);

        this.bubbleContainer.add([
            this.bubbleBody,
            this.bubbleTailGraphic,
            this.bubbleText,
        ]);
        this.bubbleContainer.setVisible(false);
        this.bubbleContainer.setDepth(10);

        // Draggable via the body
        this.bubbleBody.setInteractive({ useHandCursor: true });
        this.bubbleBody.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            this.dragTarget = this.bubbleContainer;
            this.dragOffsetX = pointer.x - this.bubbleContainer.x;
        });
    }

    /**
     * Redraws the bubble tail so its tip always points to the telephone's
     * world-space center X, regardless of where the bubble has been dragged.
     * Called every time the bubble becomes visible or is dragged.
     */
    private redrawBubbleTail() {
        // Tail tip in container-local space
        const tipX = this.PHONE_CENTER_X - this.bubbleContainer.x;
        const tipY = this.BUBBLE_H + this.BUBBLE_TAIL_H;
        const baseY = this.BUBBLE_H;
        const baseLeft = this.BUBBLE_W / 2 - 28;
        const baseRight = this.BUBBLE_W / 2 + 28;

        this.bubbleTailGraphic.clear();

        // Fill
        this.bubbleTailGraphic.fillStyle(0xd0d0d0, 1);
        this.bubbleTailGraphic.beginPath();
        this.bubbleTailGraphic.moveTo(baseLeft, baseY);
        this.bubbleTailGraphic.lineTo(baseRight, baseY);
        this.bubbleTailGraphic.lineTo(tipX, tipY);
        this.bubbleTailGraphic.closePath();
        this.bubbleTailGraphic.fillPath();

        // Outline (left and right sides only — not the base which is hidden behind bubble)
        this.bubbleTailGraphic.lineStyle(3, 0x888888, 1);
        this.bubbleTailGraphic.beginPath();
        this.bubbleTailGraphic.moveTo(baseLeft, baseY);
        this.bubbleTailGraphic.lineTo(tipX, tipY);
        this.bubbleTailGraphic.lineTo(baseRight, baseY);
        this.bubbleTailGraphic.strokePath();
    }

    // ── Report panel ──────────────────────────────────────────────────────────
    private buildReportPanel() {
        this.reportContainer = this.add.container(
            this.REPORT_DEFAULT_X,
            this.REPORT_Y,
        );

        this.reportBody = this.add
            .rectangle(
                this.REPORT_W / 2,
                this.REPORT_H / 2,
                this.REPORT_W,
                this.REPORT_H,
                0xffffff,
            )
            .setStrokeStyle(3, 0xaaaaaa)
            .setOrigin(0.5);

        this.reportText = this.add
            .text(
                12,
                12,
                "Report written by Detective Code\n\n(print output will appear here)",
                {
                    fontFamily: "Courier New",
                    fontSize: "13px",
                    color: "#111111",
                    wordWrap: { width: this.REPORT_W - 24 },
                },
            )
            .setOrigin(0, 0);

        this.reportCloseBtn = this.add
            .text(this.REPORT_W - 8, 8, "✕", {
                fontFamily: "Arial",
                fontSize: "20px",
                color: "#ffffff",
                backgroundColor: "#cc0000",
                padding: { x: 5, y: 2 },
            })
            .setOrigin(1, 0)
            .setInteractive({ useHandCursor: true });

        this.reportCloseBtn.on("pointerdown", () => this.closeReport());

        this.reportContainer.add([
            this.reportBody,
            this.reportText,
            this.reportCloseBtn,
        ]);
        this.reportContainer.setVisible(false);
        this.reportContainer.setDepth(10);

        this.reportBody.setInteractive({ useHandCursor: true });
        this.reportBody.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            this.dragTarget = this.reportContainer;
            this.dragOffsetX = pointer.x - this.reportContainer.x;
        });
    }

    // ── Hint box ──────────────────────────────────────────────────────────────
    private buildHintBox() {
        this.hintContainer = this.add.container(0, this.HINT_Y);

        this.hintBody = this.add
            .rectangle(
                this.W / 2,
                this.HINT_H / 2,
                this.W - 4,
                this.HINT_H,
                0xcccccc,
            )
            .setStrokeStyle(3, 0x888888)
            .setOrigin(0.5);

        this.hintText = this.add
            .text(
                50,
                this.HINT_H / 2,
                "(hint or success message will appear here)",
                {
                    fontFamily: "Courier New",
                    fontSize: "15px",
                    color: "#111111",
                    wordWrap: { width: this.W - 100 },
                },
            )
            .setOrigin(0, 0.5);

        this.hintCloseBtn = this.add
            .text(12, this.HINT_H / 2, "✕", {
                fontFamily: "Arial",
                fontSize: "20px",
                color: "#ffffff",
                backgroundColor: "#cc0000",
                padding: { x: 5, y: 2 },
            })
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });

        this.hintCloseBtn.on("pointerdown", () => this.closeHintBox());

        this.hintContainer.add([
            this.hintBody,
            this.hintText,
            this.hintCloseBtn,
        ]);
        this.hintContainer.setVisible(false);
        this.hintContainer.setDepth(10);
    }

    // ── Continue arrow ────────────────────────────────────────────────────────
    private buildContinueArrow() {
        this.continueArrow = this.add.container(20, 20);

        const arrowBg = this.add
            .rectangle(80, 28, 160, 48, 0x00aa00)
            .setStrokeStyle(3, 0x007700)
            .setOrigin(0.5);

        const arrowLabel = this.add
            .text(80, 28, "▶  Continue", {
                fontFamily: "Arial Black",
                fontSize: "17px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        this.continueArrow.add([arrowBg, arrowLabel]);
        this.continueArrow.setVisible(false);
        this.continueArrow.setDepth(20);

        arrowBg.setInteractive({ useHandCursor: true });
        arrowBg.on("pointerdown", () => this.changeScene());
    }

    // ── Keyboard input ────────────────────────────────────────────────────────
    private setupKeyboardInput() {
        if (!this.input.keyboard) return;

        // Prevent Phaser from consuming space/arrow keys globally so they
        // can be used freely for typing in the terminal
        this.input.keyboard.addCapture([
            Phaser.Input.Keyboard.KeyCodes.SPACE,
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
        ]);

        this.input.keyboard.on("keydown", (event: KeyboardEvent) => {
            if (!this.terminalActive) return;

            // Stop the event from bubbling to the browser / React layer
            event.preventDefault();

            const key = event.key;

            if (key === "Backspace") {
                const line = this.terminalLines[this.terminalCursorLine];
                if (line.length > 0) {
                    this.terminalLines[this.terminalCursorLine] = line.slice(
                        0,
                        -1,
                    );
                } else if (this.terminalCursorLine > 0) {
                    // Merge with previous line
                    this.terminalLines.splice(this.terminalCursorLine, 1);
                    this.terminalCursorLine--;
                }
            } else if (key === "Enter") {
                // Insert a new line after the current cursor line
                this.terminalCursorLine++;
                this.terminalLines.splice(this.terminalCursorLine, 0, "");
            } else if (key === "ArrowUp") {
                if (this.terminalCursorLine > 0) this.terminalCursorLine--;
            } else if (key === "ArrowDown") {
                if (this.terminalCursorLine < this.terminalLines.length - 1)
                    this.terminalCursorLine++;
            } else if (key.length === 1) {
                // Printable character
                this.terminalLines[this.terminalCursorLine] += key;
            }

            // Reset blink so cursor stays visible right after a keypress
            this.cursorVisible = true;
            this.cursorTimer = 0;
            this.refreshTerminalDisplay();
        });
    }

    /**
     * Rebuilds the terminal text display with the current lines and
     * a blinking cursor appended to the active line.
     */
    protected refreshTerminalDisplay() {
        const display = this.terminalLines.map((line, i) => {
            if (i === this.terminalCursorLine && this.terminalActive) {
                return line + (this.cursorVisible ? "█" : " ");
            }
            return line;
        });
        this.terminalText.setText(display.join("\n"));
    }

    // ── Interactions ──────────────────────────────────────────────────────────
    private setupInteractions() {
        this.terminalPanel.setInteractive({ useHandCursor: true });
        this.terminalPanel.on("pointerdown", () => this.activateTerminal());
        this.keyboard.on("pointerdown", () => this.activateTerminal());
        this.telephone.on("pointerdown", () => this.activateTelephone());
        this.printer.on("pointerdown", () => this.activatePrinter());
    }

    // ── Drag (horizontal only) ────────────────────────────────────────────────
    private setupDragListeners() {
        this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown || !this.dragTarget) return;
            const newX = pointer.x - this.dragOffsetX;
            const isReport = this.dragTarget === this.reportContainer;
            const halfW = isReport ? this.REPORT_W / 2 : this.BUBBLE_W / 2;
            const clampedX = Phaser.Math.Clamp(
                newX,
                -halfW + 40,
                this.W - halfW - 40,
            );
            this.dragTarget.x = clampedX;

            // Redraw tail whenever bubble is dragged so it keeps pointing at phone
            if (this.dragTarget === this.bubbleContainer) {
                this.redrawBubbleTail();
            }
        });

        this.input.on("pointerup", () => {
            this.dragTarget = null;
        });
    }

    // ── Action controllers ────────────────────────────────────────────────────
    protected activateTerminal() {
        if (this.activeAction === "telephone") this.closeTelephone();
        if (this.activeAction === "printer") this.closePrinter();
        this.activeAction = "terminal";
        this.terminalActive = true;
        this.cursorVisible = true;
        this.cursorTimer = 0;
        this.refreshTerminalDisplay();
    }

    protected activateTelephone() {
        if (this.activeAction === "telephone") {
            this.closeTelephone();
            return;
        }
        if (this.activeAction === "terminal") this.closeTerminal();
        if (this.activeAction === "printer") this.closePrinter();
        this.activeAction = "telephone";
        this.bubbleContainer.x = this.BUBBLE_DEFAULT_X;
        this.redrawBubbleTail();
        this.bubbleContainer.setVisible(true);
    }

    protected activatePrinter() {
        if (this.activeAction === "printer") {
            this.closePrinter();
            return;
        }
        if (this.activeAction === "terminal") this.closeTerminal();
        if (this.activeAction === "telephone") this.closeTelephone();
        this.activeAction = "printer";
        this.reportContainer.x = this.REPORT_DEFAULT_X;
        this.reportContainer.setVisible(true);
    }

    protected closeTerminal() {
        this.terminalActive = false;
        this.activeAction = null;
        this.refreshTerminalDisplay();
    }

    protected closeTelephone() {
        this.bubbleContainer.setVisible(false);
        this.activeAction = null;
    }

    protected closePrinter() {
        this.reportContainer.setVisible(false);
        this.activeAction = null;
    }

    private closeReport() {
        this.reportContainer.setVisible(false);
        this.activeAction = null;
        // Hint box stays open independently
    }

    private closeHintBox() {
        this.hintContainer.setVisible(false);
    }

    // ── Helpers for subclasses ────────────────────────────────────────────────

    /** Shows the hint box with a message; turns green and shows arrow if correct */
    protected showHintBox(message: string, isCorrect: boolean) {
        this.hintText.setText(message);
        this.hintBody.setFillStyle(isCorrect ? 0xaaffaa : 0xcccccc);
        this.hintContainer.setVisible(true);
        if (isCorrect) {
            this.continueArrow.setVisible(true);
        }
    }

    /** Updates the word bubble text (called in Task 5) */
    protected setBubbleText(text: string) {
        this.bubbleText.setText(text);
    }

    /** Updates the report text (called in Task 6) */
    protected setReportText(text: string) {
        this.reportText.setText("Report written by Detective Code\n\n" + text);
    }

    /** Returns the current terminal content as a single string */
    protected getTerminalContent(): string {
        return this.terminalLines.join("\n");
    }

    // ── Scene change ──────────────────────────────────────────────────────────
    changeScene() {
        this.scene.start("GameOver");
    }
}
