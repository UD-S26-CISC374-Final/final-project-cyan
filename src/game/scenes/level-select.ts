import { Scene, GameObjects } from "phaser";

export class LevelSelect extends Scene {
    title: GameObjects.Text;

    constructor() {
        super("LevelSelect");
    }

    create() {
        this.cameras.main.setBackgroundColor("#000000");

        this.title = this.add
            .text(512, 120, "Select Level", {
                fontFamily: "Arial Black",
                fontSize: 48,
                color: "#f5d742",
                stroke: "#000000",
                strokeThickness: 6,
            })
            .setOrigin(0.5);

        this.createLevelButton(512, 260, "Level 1", "Level1");
        this.createLevelButton(512, 360, "Level 2", "Level2");
        this.createLevelButton(512, 460, "Level 3", "Level3");

        this.add
            .text(512, 620, "Back", {
                fontFamily: "Arial Black",
                fontSize: 28,
                color: "#ffffff",
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => {
                this.scene.start("MainMenu");
            });
    }

    private createLevelButton(
        x: number,
        y: number,
        label: string,
        sceneKey: string,
    ) {
        const button = this.add
            .text(x, y, label, {
                fontFamily: "Arial Black",
                fontSize: 34,
                color: "#111111",
                backgroundColor: "#f5d742",
                padding: { x: 35, y: 14 },
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

        button.on("pointerdown", () => {
            this.scene.start(sceneKey);
        });
    }
}
