import { Scene, GameObjects } from "phaser";
import { EventBus } from "../event-bus";
import { PythonExecutor } from "../python-executor";
import type { LevelFunction } from "../python-executor";

/**
 * BaseLevel defines the shared layout and interactivity for all game levels.
 *
 * Layout:
 *   - Smartboard (top-left)  : transcript (read-only) + terminal (editable)
 *   - Blackboard (top-right) : function trace table (auto-filled later)
 *   - Desk (bottom)          : spans full width
 *   - Keyboard (desk-left)   : activates terminal
 *   - Telephone (desk-center): calls the function the cursor is over
 *   - Printer (desk-right)   : runs program and shows report
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
    protected readonly TRANSCRIPT_H = 340;
    protected readonly TERMINAL_Y = this.SB_Y + this.TRANSCRIPT_H + 4;
    protected readonly TERMINAL_H = this.SB_H - this.TRANSCRIPT_H - 4;

    // ── Blackboard (top-right) ────────────────────────────────────────────────
    protected readonly BB_X = 520;
    protected readonly BB_Y = 10;
    protected readonly BB_W = 494;
    protected readonly BB_H = 540;

    // Blackboard table layout
    protected readonly BB_TABLE_X = 528;
    protected readonly BB_TABLE_Y = 50;
    protected readonly BB_COL_TRACE = 50;
    protected readonly BB_COL_EVENT = 160;
    protected readonly BB_COL_DETAIL = 200;
    protected readonly BB_ROW_H = 36;

    // ── Desk items ────────────────────────────────────────────────────────────
    protected readonly ITEM_Y = this.DESK_Y + 20;
    protected readonly ITEM_H = 120;
    protected readonly ITEM_W = 200;
    protected readonly KEYBOARD_X = 100;
    protected readonly PHONE_X = 412;
    protected readonly PRINTER_X = 724;

    protected readonly PHONE_CENTER_X = this.PHONE_X + this.ITEM_W / 2;
    protected readonly PHONE_CENTER_Y = this.ITEM_Y + this.ITEM_H / 2;

    // ── Word bubble ───────────────────────────────────────────────────────────
    protected readonly BUBBLE_W = 460;
    protected readonly BUBBLE_H = 320;
    protected readonly BUBBLE_TAIL_H = 40;
    protected readonly BUBBLE_DEFAULT_X = 500;
    protected readonly BUBBLE_Y = 180;

    // ── Report panel ──────────────────────────────────────────────────────────
    protected readonly REPORT_W = 340;
    protected readonly REPORT_H = 300;
    protected readonly REPORT_DEFAULT_X = 660;
    protected readonly REPORT_Y = 30;

    // ── Hint box ──────────────────────────────────────────────────────────────
    protected readonly HINT_Y = 630;
    protected readonly HINT_H = 90;

    // ── Terminal state ────────────────────────────────────────────────────────
    protected terminalLines: string[] = [""];
    protected cursorLine = 0;
    protected cursorCol = 0;
    private terminalTopLine = 0;
    protected terminalActive = false;

    // ── Python executor ───────────────────────────────────────────────────────
    protected executor!: PythonExecutor;

    // Stored for re-loading transcript variables before each telephone call
    private levelTranscript = "";
    private levelCorrectAnswer = "";

    // ── Layout objects ────────────────────────────────────────────────────────
    protected desk!: GameObjects.Rectangle;
    protected smartboard!: GameObjects.Rectangle;
    protected transcriptPanel!: GameObjects.Rectangle;
    protected transcriptText!: GameObjects.Text;
    protected terminalPanel!: GameObjects.Rectangle;
    protected terminalText!: GameObjects.Text;
    protected blackboard!: GameObjects.Rectangle;
    protected blackboardLabel!: GameObjects.Text;
    protected blackboardGraphics!: GameObjects.Graphics;
    protected blackboardRows: GameObjects.Text[] = [];
    protected blackboardHeaderTexts: GameObjects.Text[] = [];
    private blackboardRowKeys = new Set<string>();
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

    private dragTarget: GameObjects.Container | null = null;
    private dragOffsetX = 0;

    private cursorVisible = true;
    private cursorTimer = 0;
    private readonly CURSOR_BLINK_MS = 530;
    private terminalSolved = false;

    // ── Abstract ──────────────────────────────────────────────────────────────
    protected abstract getLevelData(): {
        transcript: string;
        correctAnswer: string;
        functions: Record<string, LevelFunction>;
        initialTerminalLines?: string[];
    };

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    create() {
        const levelData = this.getLevelData();

        this.levelTranscript = levelData.transcript;
        this.levelCorrectAnswer = levelData.correctAnswer;
        this.executor = new PythonExecutor(levelData.functions);
        this.executor.loadTranscript(levelData.transcript);

        if (
            levelData.initialTerminalLines &&
            levelData.initialTerminalLines.length > 0
        ) {
            this.terminalLines = [...levelData.initialTerminalLines, ""];
            this.cursorLine = this.terminalLines.length - 1;
            this.cursorCol = 0;
        }

        this.buildLayout(levelData.transcript);
        this.buildWordBubble();
        this.buildReportPanel();
        this.buildHintBox();
        this.buildContinueArrow();
        this.setupInteractions();
        this.setupDragListeners();
        this.setupKeyboardInput();
        this.refreshTerminalDisplay();

        EventBus.emit("current-scene-ready", this);
    }

    update(_time: number, delta: number) {
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
    private buildLayout(transcript: string) {
        this.desk = this.add
            .rectangle(
                this.DESK_X + this.DESK_W / 2,
                this.DESK_Y + this.DESK_H / 2,
                this.DESK_W,
                this.DESK_H,
                0x8b4513,
            )
            .setStrokeStyle(4, 0x5c2d0a);

        this.smartboard = this.add
            .rectangle(
                this.SB_X + this.SB_W / 2,
                this.SB_Y + this.SB_H / 2,
                this.SB_W,
                this.SB_H,
                0x1a1a2e,
            )
            .setStrokeStyle(4, 0x4a9eff);

        this.transcriptPanel = this.add
            .rectangle(
                this.SB_X + this.SB_W / 2,
                this.SB_Y + this.TRANSCRIPT_H / 2,
                this.SB_W - 8,
                this.TRANSCRIPT_H - 4,
                0xffffff,
            )
            .setStrokeStyle(2, 0xaaaaaa);

        this.transcriptText = this.add
            .text(this.SB_X + 12, this.SB_Y + 10, transcript, {
                fontFamily: "Courier New",
                fontSize: "12px",
                color: "#111111",
                wordWrap: { width: this.SB_W - 28 },
            })
            .setOrigin(0, 0);

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
                padding: { bottom: 8 },
                lineSpacing: 6,
            })
            .setOrigin(0, 0);

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

        this.blackboardGraphics = this.add.graphics();
        this.drawTraceTableHeader();

        const y = this.ITEM_Y;
        const h = this.ITEM_H;
        const w = this.ITEM_W;

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
            .text(12, 12, "", {
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

        this.bubbleBody.setInteractive({ useHandCursor: true });
        this.bubbleBody.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            this.dragTarget = this.bubbleContainer;
            this.dragOffsetX = pointer.x - this.bubbleContainer.x;
        });
    }

    private redrawBubbleTail() {
        const tipX = this.PHONE_CENTER_X - this.bubbleContainer.x;
        const tipY = this.BUBBLE_H + this.BUBBLE_TAIL_H;
        const baseY = this.BUBBLE_H;
        const baseLeft = this.BUBBLE_W / 2 - 28;
        const baseRight = this.BUBBLE_W / 2 + 28;

        this.bubbleTailGraphic.clear();

        this.bubbleTailGraphic.fillStyle(0xd0d0d0, 1);
        this.bubbleTailGraphic.beginPath();
        this.bubbleTailGraphic.moveTo(baseLeft, baseY);
        this.bubbleTailGraphic.lineTo(baseRight, baseY);
        this.bubbleTailGraphic.lineTo(tipX, tipY);
        this.bubbleTailGraphic.closePath();
        this.bubbleTailGraphic.fillPath();

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

        this.input.keyboard.addCapture([
            Phaser.Input.Keyboard.KeyCodes.SPACE,
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
        ]);

        this.input.keyboard.on("keydown", (event: KeyboardEvent) => {
            // ── Device shortcuts (work even when terminal is not focused) ─────
            // Shift+Enter → focus terminal
            // Ctrl+Enter  → activate telephone
            // Alt+Enter   → activate printer
            if (event.key === "Enter" && event.shiftKey) {
                event.preventDefault();
                this.activateTerminal();
                return;
            }
            if (event.key === "Enter" && event.ctrlKey) {
                event.preventDefault();
                this.activateTelephone();
                return;
            }
            if (event.key === "Enter" && event.altKey) {
                event.preventDefault();
                this.activatePrinter();
                return;
            }

            if (!this.terminalActive) return;
            event.preventDefault();

            const key = event.key;
            const ctrl = event.ctrlKey || event.metaKey;
            const line = this.terminalLines[this.cursorLine];
            const lastLine = this.terminalLines.length - 1;

            // ── Movement keys (always work, even after solving) ───────────────
            if (key === "ArrowUp") {
                if (ctrl) {
                    // Ctrl+Up → jump to very beginning of first line
                    this.cursorLine = 0;
                    this.cursorCol = 0;
                } else if (this.cursorLine > 0) {
                    this.cursorLine--;
                    this.cursorCol = Math.min(
                        this.cursorCol,
                        this.terminalLines[this.cursorLine].length,
                    );
                } else {
                    // Already on first line → go to beginning of it
                    this.cursorCol = 0;
                }
            } else if (key === "ArrowDown") {
                if (ctrl) {
                    // Ctrl+Down → jump to very end of last line
                    this.cursorLine = lastLine;
                    this.cursorCol = this.terminalLines[lastLine].length;
                } else if (this.cursorLine < lastLine) {
                    this.cursorLine++;
                    this.cursorCol = Math.min(
                        this.cursorCol,
                        this.terminalLines[this.cursorLine].length,
                    );
                } else {
                    // Already on last line → go to end of it
                    this.cursorCol = this.terminalLines[lastLine].length;
                }
            } else if (key === "ArrowLeft") {
                if (ctrl) {
                    // Ctrl+Left → jump to start of previous word
                    this.cursorCol = this.findWordLeft(line, this.cursorCol);
                } else if (this.cursorCol > 0) {
                    this.cursorCol--;
                } else if (this.cursorLine > 0) {
                    // Wrap up to end of previous line
                    this.cursorLine--;
                    this.cursorCol = this.terminalLines[this.cursorLine].length;
                }
            } else if (key === "ArrowRight") {
                if (ctrl) {
                    // Ctrl+Right → jump to end of next word
                    this.cursorCol = this.findWordRight(line, this.cursorCol);
                } else if (this.cursorCol < line.length) {
                    this.cursorCol++;
                } else if (this.cursorLine < lastLine) {
                    // Wrap down to start of next line
                    this.cursorLine++;
                    this.cursorCol = 0;
                }
            } else if (key === "Home") {
                this.cursorCol = 0;
            } else if (key === "End") {
                this.cursorCol = this.terminalLines[this.cursorLine].length;

                // ── Editing keys (locked after solving) ───────────────────────────
            } else if (!this.terminalSolved) {
                if (key === "Backspace") {
                    if (this.cursorCol > 0) {
                        this.terminalLines[this.cursorLine] =
                            line.slice(0, this.cursorCol - 1) +
                            line.slice(this.cursorCol);
                        this.cursorCol--;
                    } else if (this.cursorLine > 0) {
                        const prevLine =
                            this.terminalLines[this.cursorLine - 1];
                        this.terminalLines[this.cursorLine - 1] =
                            prevLine + line;
                        this.terminalLines.splice(this.cursorLine, 1);
                        this.cursorLine--;
                        this.cursorCol = prevLine.length;
                    }
                } else if (key === "Delete") {
                    if (this.cursorCol < line.length) {
                        this.terminalLines[this.cursorLine] =
                            line.slice(0, this.cursorCol) +
                            line.slice(this.cursorCol + 1);
                    } else if (this.cursorLine < lastLine) {
                        this.terminalLines[this.cursorLine] =
                            line + this.terminalLines[this.cursorLine + 1];
                        this.terminalLines.splice(this.cursorLine + 1, 1);
                    }
                } else if (key === "Enter") {
                    const before = line.slice(0, this.cursorCol);
                    const after = line.slice(this.cursorCol);
                    this.terminalLines[this.cursorLine] = before;
                    this.terminalLines.splice(this.cursorLine + 1, 0, after);
                    this.cursorLine++;
                    this.cursorCol = 0;
                } else if (key.length === 1 && !ctrl) {
                    this.terminalLines[this.cursorLine] =
                        line.slice(0, this.cursorCol) +
                        key +
                        line.slice(this.cursorCol);
                    this.cursorCol++;
                }
            }

            this.cursorVisible = true;
            this.cursorTimer = 0;
            this.refreshTerminalDisplay();
        });
    }

    private getTerminalVisibleLineCount(): number {
        const verticalPadding = 20;
        const fontSize = 14;
        const lineSpacing = 6;
        const lineHeight = fontSize + lineSpacing;
        return Math.max(
            1,
            Math.floor((this.TERMINAL_H - verticalPadding) / lineHeight),
        );
    }

    private clampTerminalViewport() {
        const visibleLineCount = this.getTerminalVisibleLineCount();
        const maxTopLine = Math.max(
            0,
            this.terminalLines.length - visibleLineCount,
        );

        if (this.cursorLine < this.terminalTopLine) {
            this.terminalTopLine = this.cursorLine;
        } else if (this.cursorLine >= this.terminalTopLine + visibleLineCount) {
            this.terminalTopLine = this.cursorLine - visibleLineCount + 1;
        }

        this.terminalTopLine = Phaser.Math.Clamp(
            this.terminalTopLine,
            0,
            maxTopLine,
        );
    }

    protected refreshTerminalDisplay() {
        this.clampTerminalViewport();

        const visibleLineCount = this.getTerminalVisibleLineCount();
        const visibleLines = this.terminalLines.slice(
            this.terminalTopLine,
            this.terminalTopLine + visibleLineCount,
        );

        const display = visibleLines.map((line, visibleIndex) => {
            const lineIndex = this.terminalTopLine + visibleIndex;
            if (lineIndex === this.cursorLine && this.terminalActive) {
                const before = line.slice(0, this.cursorCol);
                const atCursor = line[this.cursorCol] ?? "";
                const after = line.slice(this.cursorCol + 1);
                const cursorChar = this.cursorVisible ? "\u2588" : atCursor;
                return before + cursorChar + after;
            }
            return line;
        });

        this.terminalText.setText(display.join("\n"));
    }

    // ── Interactions ──────────────────────────────────────────────────────────

    /**
     * Ctrl+Left: finds the start of the word to the left of the cursor.
     * Skips any spaces, then skips back through word characters.
     */
    private findWordLeft(line: string, col: number): number {
        let i = col;
        while (i > 0 && line[i - 1] === " ") i--;
        while (i > 0 && line[i - 1] !== " ") i--;
        return i;
    }

    /**
     * Ctrl+Right: finds the end of the word to the right of the cursor.
     * Skips any spaces, then skips forward through word characters.
     */
    private findWordRight(line: string, col: number): number {
        let i = col;
        while (i < line.length && line[i] === " ") i++;
        while (i < line.length && line[i] !== " ") i++;
        return i;
    }

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
        // If already open, toggle it closed
        if (this.activeAction === "telephone") {
            this.closeTelephone();
            return;
        }
        if (this.activeAction === "terminal") this.closeTerminal();
        if (this.activeAction === "printer") this.closePrinter();
        this.activeAction = "telephone";

        // ── Telephone call logic ──────────────────────────────────────────────
        const currentLine = this.terminalLines[this.cursorLine];

        // Find which function the cursor is currently over
        const span = this.executor.findFunctionAtColumn(
            currentLine,
            this.cursorCol,
        );

        if (span === null) {
            // Cursor is not over any function name
            this.showBubble(
                `No function found at cursor position.\n\n` +
                    `Move your cursor over a function name\n` +
                    `before picking up the telephone.`,
            );
            return;
        }

        // Reset executor state and reload transcript variables so lines above
        // the cursor run cleanly with fresh state each time
        this.executor.resetPlayerVariables();
        this.executor.loadTranscript(this.levelTranscript);

        // Run all lines strictly above the cursor line to set up any
        // variable assignments the current line may depend on
        this.executor.runLinesAbove(
            this.terminalLines.join("\n"),
            this.cursorLine,
        );

        // Now call the specific function the cursor is over.
        // The executor resolves its arguments (including nested calls) internally.
        const result = this.executor.callForTelephone(span.fullExpression);

        // Build the bubble message
        let message = "";
        if (result.type === "error") {
            message = `Error calling ${span.name}():\n\n${result.output}`;
        } else {
            message = `${span.name}() says:\n\n${result.output}`;

            // Add a row to the blackboard trace table
            const traceLog = this.executor.getTraceLog();
            const step = traceLog.length;
            const argStr = result.args.map((a) => JSON.stringify(a)).join(", ");
            const eventStr = `Call ${span.name}(${argStr})`;
            const detailStr = `returns "${result.output}"`;
            this.addTraceRow(step, eventStr, detailStr);
        }

        this.showBubble(message);
    }

    protected activatePrinter() {
        if (this.activeAction === "printer") {
            this.closePrinter();
            return;
        }
        if (this.activeAction === "terminal") this.closeTerminal();
        if (this.activeAction === "telephone") this.closeTelephone();
        this.activeAction = "printer";

        // Reset and reload transcript variables so the full program
        // runs with a clean state each time the printer is clicked
        this.executor.resetPlayerVariables();
        this.executor.loadTranscript(this.levelTranscript);
        this.executor.reset();
        this.clearTraceTable();

        // Run the entire terminal content and collect diagnostics
        const results = this.executor.runAll(this.getTerminalContent());
        const output = this.executor.getPrintOutput();

        this.setReportText(output.length > 0 ? output : "(no print output)");
        this.showHintBox(
            this.pickHint(results, output),
            this.checkAnswer(output, this.levelCorrectAnswer),
        );
        if (this.checkAnswer(output, this.levelCorrectAnswer)) {
            this.terminalSolved = true;
        }

        this.reportContainer.x = this.REPORT_DEFAULT_X;
        this.reportContainer.setVisible(true);
    }

    /**
     * Picks the highest-priority hint message based on the player's output
     * and the diagnostics collected by the executor.
     */
    private pickHint(
        results: import("../python-executor").LineResult[],
        output: string,
    ): string {
        // ── Priority 10: Correct answer ───────────────────────────────────────
        if (this.checkAnswer(output, this.levelCorrectAnswer)) {
            return (
                "This report looks correct! Press the green arrow when you " +
                "are ready to move onto the next mystery."
            );
        }

        // ── Priority 9: Correct value computed but not printed ────────────────
        const correctLines = this.levelCorrectAnswer
            .split("\n")
            .map((l) => l.trim().toLowerCase())
            .filter((l) => l.length > 0);

        const callOutputs = results
            .filter((r) => r.type === "call")
            .map((r) => r.output.trim().toLowerCase());

        const hasUnprintedAnswer = correctLines.every((req) =>
            callOutputs.some((o) => o === req),
        );
        if (hasUnprintedAnswer) {
            return (
                "You have the right answer! You just need to print it. " +
                "Wrap your function call inside print() — " +
                "for example: print(your_function(args))"
            );
        }

        // ── Priority 8: Terminal is overcrowded ───────────────────────────────
        const occupiedLines = this.terminalLines.filter((l) => {
            const t = l.trim();
            return t.length > 0 && !t.startsWith("#");
        });
        if (occupiedLines.length >= 6) {
            return (
                "Your terminal is getting crowded! Try deleting function calls " +
                "or print() statements you no longer need to keep things clear."
            );
        }

        // ── Priority 4: Undefined variable used inside print() ────────────────
        const printResults = results.filter((r) => r.type === "print");
        const errorResults = results.filter((r) => r.type === "error");

        const undefinedInPrint = errorResults.some((r) =>
            r.output.includes("Cannot resolve:"),
        );
        if (undefinedInPrint) {
            const match = errorResults.find((r) =>
                r.output.includes("Cannot resolve:"),
            );
            const varName =
                match ?
                    match.output.replace("Cannot resolve:", "").trim()
                :   "a variable";
            return (
                `"${varName}" is being treated as a variable inside your ` +
                `print() statement, but it hasn't been defined. ` +
                `If you meant it as text, wrap it in quotes: print("${varName}")`
            );
        }

        // ── Priority 3: print() ran but result is wrong ───────────────────────
        if (printResults.length > 0) {
            return (
                "It doesn't seem like this report has the correct information. " +
                "Double check your work — try using the telephone to verify " +
                "what your function calls are returning."
            );
        }

        // ── Priority 2: Function called with wrong number of parameters ────────
        const wrongArgCount = errorResults.some(
            (r) =>
                r.output.includes("Cannot parse:") ||
                r.output.includes("Unknown function:"),
        );
        if (wrongArgCount) {
            return (
                "One of your function calls doesn't look right. " +
                "Try calling help('function_name') to see how to use it."
            );
        }

        // ── Priority 1: No print output at all ────────────────────────────────
        return (
            "Your report is empty! Start by calling help() to get instructions. " +
            "Move your text cursor over the word 'help' in the terminal, " +
            "then click the telephone to make the call."
        );
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
    }

    private closeHintBox() {
        this.hintContainer.setVisible(false);
    }

    // ── Helpers for subclasses ────────────────────────────────────────────────
    protected showHintBox(message: string, isCorrect: boolean) {
        this.hintText.setText(message);
        this.hintBody.setFillStyle(isCorrect ? 0xaaffaa : 0xcccccc);
        this.hintContainer.setVisible(true);
        if (isCorrect) {
            this.continueArrow.setVisible(true);
        }
    }

    protected setBubbleText(text: string) {
        this.bubbleText.setText(text);
    }

    protected setReportText(text: string) {
        this.reportText.setText("Report written by Detective Code\n\n" + text);
    }

    // REQUIRED for telephone
    private showBubble(message: string) {
        this.bubbleContainer.x = this.BUBBLE_DEFAULT_X;
        this.bubbleText.setText(message);
        this.redrawBubbleTail();
        this.bubbleContainer.setVisible(true);
    }

    protected getTerminalContent(): string {
        return this.terminalLines.join("\n");
    }

    /**
     * Lenient answer checker.
     * Every line in correctAnswer must appear somewhere in the player's output.
     * Extra lines in the player's output are ignored.
     * Comparison is case-insensitive and trims whitespace.
     */
    private checkAnswer(playerOutput: string, correctAnswer: string): boolean {
        const playerLines = playerOutput
            .split("\n")
            .map((l) => l.trim().toLowerCase())
            .filter((l) => l.length > 0);

        const requiredLines = correctAnswer
            .split("\n")
            .map((l) => l.trim().toLowerCase())
            .filter((l) => l.length > 0);

        return requiredLines.every((required) =>
            playerLines.some((player) => player === required),
        );
    }

    // ── Blackboard trace table ────────────────────────────────────────────────

    private drawTraceTableHeader() {
        const g = this.blackboardGraphics;
        const x = this.BB_TABLE_X;
        const y = this.BB_TABLE_Y;
        const totalW =
            this.BB_COL_TRACE + this.BB_COL_EVENT + this.BB_COL_DETAIL;
        const rowH = this.BB_ROW_H;

        // Header text is also GameObject state. Destroy it before redrawing,
        // otherwise clearTraceTable() leaves old header labels stacked on top.
        for (const obj of this.blackboardHeaderTexts) {
            obj.destroy();
        }
        this.blackboardHeaderTexts = [];

        g.clear();

        // Header background
        g.fillStyle(0x1a3a0f, 1);
        g.fillRect(x, y, totalW, rowH);

        // Outer border
        g.lineStyle(2, 0xaaddaa, 1);
        g.strokeRect(x, y, totalW, rowH);

        // Column dividers
        g.lineStyle(1, 0xaaddaa, 1);
        g.beginPath();
        g.moveTo(x + this.BB_COL_TRACE, y);
        g.lineTo(x + this.BB_COL_TRACE, y + rowH);
        g.moveTo(x + this.BB_COL_TRACE + this.BB_COL_EVENT, y);
        g.lineTo(x + this.BB_COL_TRACE + this.BB_COL_EVENT, y + rowH);
        g.strokePath();

        const headerStyle = {
            fontFamily: "Courier New",
            fontSize: "12px",
            color: "#e8f5e1",
            align: "center" as const,
        };

        const stepHeader = this.add
            .text(x + this.BB_COL_TRACE / 2, y + rowH / 2, "Step", headerStyle)
            .setOrigin(0.5);

        const eventHeader = this.add
            .text(
                x + this.BB_COL_TRACE + this.BB_COL_EVENT / 2,
                y + rowH / 2,
                "Event",
                headerStyle,
            )
            .setOrigin(0.5);

        const detailHeader = this.add
            .text(
                x +
                    this.BB_COL_TRACE +
                    this.BB_COL_EVENT +
                    this.BB_COL_DETAIL / 2,
                y + rowH / 2,
                "Details",
                headerStyle,
            )
            .setOrigin(0.5);

        this.blackboardHeaderTexts.push(stepHeader, eventHeader, detailHeader);
    }

    private normalizeTraceCellText(value: string): string {
        return value.replace(/\s+/g, " ").trim();
    }

    private fitTraceCellText(value: string, colWidth: number): string {
        const fontSize = 11;
        const lineSpacing = 1;
        const horizontalPadding = 8;
        const verticalPadding = 8;
        const usableWidth = colWidth - horizontalPadding;
        const maxLines = Math.max(
            1,
            Math.floor(
                (this.BB_ROW_H - verticalPadding) / (fontSize + lineSpacing),
            ),
        );

        // Courier New is monospace; this approximation keeps text inside the
        // fixed-height row without relying on runtime text measurement.
        const charsPerLine = Math.max(
            4,
            Math.floor(usableWidth / (fontSize * 0.62)),
        );
        const words = this.normalizeTraceCellText(value).split(" ");
        const lines: string[] = [];
        let current = "";

        for (const word of words) {
            if (word.length > charsPerLine) {
                if (current) {
                    lines.push(current);
                    current = "";
                }
                for (let i = 0; i < word.length; i += charsPerLine) {
                    lines.push(word.slice(i, i + charsPerLine));
                }
                continue;
            }

            const next = current ? `${current} ${word}` : word;
            if (next.length > charsPerLine) {
                lines.push(current);
                current = word;
            } else {
                current = next;
            }
        }

        if (current) lines.push(current);

        if (lines.length <= maxLines) return lines.join("\n");

        const fitted = lines.slice(0, maxLines);
        const last = fitted[fitted.length - 1];
        fitted[fitted.length - 1] =
            last.length >= charsPerLine ?
                `${last.slice(0, charsPerLine - 1)}…`
            :   `${last}…`;
        return fitted.join("\n");
    }

    protected addTraceRow(step: number, event: string, details: string) {
        const x = this.BB_TABLE_X;
        const rowH = this.BB_ROW_H;
        const totalW =
            this.BB_COL_TRACE + this.BB_COL_EVENT + this.BB_COL_DETAIL;
        const maxRows = Math.floor(
            (this.BB_H - (this.BB_TABLE_Y - this.BB_Y) - rowH - 8) / rowH,
        );

        const eventForKey = this.normalizeTraceCellText(event);
        const detailsForKey = this.normalizeTraceCellText(details);
        const rowKey = `${eventForKey}::${detailsForKey}`;

        // Prevent repeated rows when the same telephone call is made again.
        if (this.blackboardRowKeys.has(rowKey)) return;

        const rowIndex = Math.floor(this.blackboardRows.length / 3);
        if (rowIndex >= maxRows) return;

        this.blackboardRowKeys.add(rowKey);

        const rowY = this.BB_TABLE_Y + rowH + rowIndex * rowH;
        const bg = rowIndex % 2 === 0 ? 0x2d5a1b : 0x244d16;

        this.blackboardGraphics.fillStyle(bg, 1);
        this.blackboardGraphics.fillRect(x, rowY, totalW, rowH);

        this.blackboardGraphics.lineStyle(1, 0x6aaa6a, 1);
        this.blackboardGraphics.strokeRect(x, rowY, totalW, rowH);

        this.blackboardGraphics.lineStyle(1, 0x6aaa6a, 1);
        this.blackboardGraphics.beginPath();
        this.blackboardGraphics.moveTo(x + this.BB_COL_TRACE, rowY);
        this.blackboardGraphics.lineTo(x + this.BB_COL_TRACE, rowY + rowH);
        this.blackboardGraphics.moveTo(
            x + this.BB_COL_TRACE + this.BB_COL_EVENT,
            rowY,
        );
        this.blackboardGraphics.lineTo(
            x + this.BB_COL_TRACE + this.BB_COL_EVENT,
            rowY + rowH,
        );
        this.blackboardGraphics.strokePath();

        const cellStyle = {
            fontFamily: "Courier New",
            fontSize: "11px",
            color: "#d0f0d0",
            lineSpacing: 1,
        };

        const stepText = this.add
            .text(x + this.BB_COL_TRACE / 2, rowY + rowH / 2, String(step), {
                ...cellStyle,
                align: "center" as const,
            })
            .setOrigin(0.5);

        const eventText = this.add
            .text(
                x + this.BB_COL_TRACE + 4,
                rowY + 4,
                this.fitTraceCellText(event, this.BB_COL_EVENT),
                {
                    ...cellStyle,
                    wordWrap: { width: this.BB_COL_EVENT - 8 },
                },
            )
            .setOrigin(0, 0);

        const detailText = this.add
            .text(
                x + this.BB_COL_TRACE + this.BB_COL_EVENT + 4,
                rowY + 4,
                this.fitTraceCellText(details, this.BB_COL_DETAIL),
                {
                    ...cellStyle,
                    wordWrap: { width: this.BB_COL_DETAIL - 8 },
                },
            )
            .setOrigin(0, 0);

        this.blackboardRows.push(stepText, eventText, detailText);
    }

    protected clearTraceTable() {
        for (const obj of this.blackboardRows) {
            obj.destroy();
        }
        this.blackboardRows = [];
        this.blackboardRowKeys.clear();
        this.drawTraceTableHeader();
    }

    public createBackButton() {
        const { height } = this.scale;

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
            .setDepth(9999);

        backButton.on("pointerdown", () => {
            this.showConfirmDialog();
        });
    }
    public showConfirmDialog() {
        if (this.children.getByName("confirm")) return;

        const { width, height } = this.scale;

        const overlay = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.6)
            .setOrigin(0)
            .setDepth(2000)
            .setName("confirm");

        const box = this.add
            .rectangle(width / 2, height / 2, 400, 200, 0x222222)
            .setStrokeStyle(2, 0xf5d742)
            .setDepth(2001);

        const text = this.add
            .text(width / 2, height / 2 - 40, "Return to Level Select?", {
                fontFamily: "Arial",
                fontSize: 22,
                color: "#ffffff",
            })
            .setOrigin(0.5)
            .setDepth(2002);

        const yesBtn = this.add
            .text(width / 2 - 80, height / 2 + 40, "Yes", {
                fontSize: 20,
                color: "#111111",
                backgroundColor: "#f5d742",
                padding: { x: 15, y: 8 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(2002);

        const noBtn = this.add
            .text(width / 2 + 80, height / 2 + 40, "No", {
                fontSize: 20,
                color: "#ffffff",
                backgroundColor: "#444444",
                padding: { x: 15, y: 8 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(2002);

        yesBtn.on("pointerdown", () => {
            this.scene.start("LevelSelect");
        });

        noBtn.on("pointerdown", () => {
            overlay.destroy();
            box.destroy();
            text.destroy();
            yesBtn.destroy();
            noBtn.destroy();
        });
    }
    // ── Scene change ──────────────────────────────────────────────────────────
    changeScene() {
        this.scene.start("GameOver");
    }
}
