import { GameObjects, Scene } from "phaser";

import { EventBus } from "../event-bus";
import type { ChangeableScene } from "../reactable-scene";

export class MainMenu extends Scene implements ChangeableScene {
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    subtitle: GameObjects.Text;
    startButton: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null;

    constructor() {
        super("MainMenu");
    }

    create() {
        this.cameras.main.setBackgroundColor("#000000");

        this.logo = this.add
            .image(512, 250, "logo")
            .setScale(0.2)
            .setDepth(100);

        //主标题
        this.title = this.add
            .text(512, 420, "Detective Code", {
                fontFamily: "Arial Black",
                fontSize: 48,
                color: "#f5d742",
                stroke: "#000000",
                strokeThickness: 10,
                align: "center",
            })
            .setOrigin(0.5)
            .setDepth(100);

        // 副标题
        this.subtitle = this.add
            .text(512, 480, "CISC374 Final Project", {
                fontFamily: "Arial",
                fontSize: 20,
                color: "#ffffff",
                align: "center",
            })
            .setOrigin(0.5);

        //  开始按钮
        this.startButton = this.add
            .text(512, 560, "Start Game", {
                fontFamily: "Arial Black",
                fontSize: 32,
                color: "#111111",
                backgroundColor: "#f5d742",
                padding: { x: 25, y: 12 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        // 点击开始游戏
        this.startButton.on("pointerdown", () => {
            this.changeScene();
        });

        // 鼠标悬停效果
        this.startButton.on("pointerover", () => {
            this.startButton.setStyle({
                backgroundColor: "#ffe066",
            });
        });

        this.startButton.on("pointerout", () => {
            this.startButton.setStyle({
                backgroundColor: "#f5d742",
            });
        });

        EventBus.emit("current-scene-ready", this);
    }

    changeScene() {
        if (this.logoTween) {
            this.logoTween.stop();
            this.logoTween = null;
        }

        this.scene.start("LevelSelect");
    }
}
