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
        // Add any future Detective Code assets here
    }

    create() {
        // Go straight to Level1 — no main menu needed for now
        this.scene.start("Level1");
    }
}
