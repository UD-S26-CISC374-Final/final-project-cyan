import { Scene, GameObjects } from "phaser";

export class GameOver extends Scene {
    title: GameObjects.Text;
    message: GameObjects.Text;
    restartButton: GameObjects.Text;
    menuButton: GameObjects.Text;

    constructor() {
        super("GameOver");
    }

    create() {
        this.cameras.main.setBackgroundColor("#000000");

        const { width, height } = this.scale;

        this.title = this.add
            .text(width / 2, height * 0.25, "Congratulation", {
                fontFamily: "Arial Black",
                fontSize: 56,
                color: "#f5d742",
                stroke: "#000000",
                strokeThickness: 8,
            })
            .setOrigin(0.5);

        this.message = this.add
            .text(width / 2, height * 0.38, "You solved the Detective Code.", {
                fontFamily: "Courier New",
                fontSize: 24,
                color: "#ffffff",
            })
            .setOrigin(0.5);

        this.restartButton = this.createButton(
            width / 2,
            height * 0.55,
            "Play Again",
            () => this.scene.start("LevelSelect"),
        );

        this.menuButton = this.createButton(
            width / 2,
            height * 0.68,
            "Main Menu",
            () => this.scene.start("MainMenu"),
        );
    }

    private createButton(
        x: number,
        y: number,
        text: string,
        onClick: () => void,
    ) {
        const button = this.add
            .text(x, y, text, {
                fontFamily: "Arial Black",
                fontSize: 32,
                color: "#111111",
                backgroundColor: "#f5d742",
                padding: { x: 28, y: 12 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        button.on("pointerover", () => {
            button.setStyle({ backgroundColor: "#ffe066" });
            button.setScale(1.08);
        });

        button.on("pointerout", () => {
            button.setStyle({ backgroundColor: "#f5d742" });
            button.setScale(1);
        });

        button.on("pointerdown", onClick);

        return button;
    }
}
