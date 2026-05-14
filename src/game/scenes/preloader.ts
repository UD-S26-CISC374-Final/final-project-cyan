import { Scene } from "phaser";

export class Preloader extends Scene {
    constructor() {
        super("Preloader");
    }

    init() {
        // Simple progress bar while assets load
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);
        const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);
        this.load.on("progress", (progress: number) => {
            bar.width = 4 + 460 * progress;
        });
    }

    preload() {
        this.load.setPath("assets");
        this.load.image("logo", "logo.png");

        // Detective Code game assets
        this.load.image("bg", "Detective_code_background.png");
        this.load.image("whiteboard", "Detective_code_whiteboard.png");
        this.load.image("blackboard", "Detective_code_blackboard.png");
        this.load.image("table", "Detective_code_table.png");
        this.load.image("keyboard", "Detective_code_keyboard.png");
        this.load.image("telephone", "Detective_code_telephone.png");
        this.load.image("printer", "Detective_code_printer.png");
    }

    create() {
        // Go main menu(required)
        this.scene.start("MainMenu");
    }
}
