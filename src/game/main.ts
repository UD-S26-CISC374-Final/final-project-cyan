import { Boot } from "./scenes/boot";
import { Level1 } from "./scenes/level1";
import { AUTO, Game } from "phaser";
import { Preloader } from "./scenes/preloader";

/**
 * Main Phaser game config for Detective Code.
 *
 * Scene order: Boot → Preloader → Level1
 * MainMenu and GameOver have been removed — the game starts directly
 * in Level1 after assets are loaded. A proper level-complete flow
 * will be added later via the BaseLevel continue arrow.
 */
const config: Phaser.Types.Core.GameConfig = {
    title: "Detective Code",
    version: "0.1.0",
    type: AUTO,
    parent: "game-container",
    backgroundColor: "#1a1a1a",
    scene: [Boot, Preloader, Level1],
    scale: {
        parent: "phaser-game",
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1024,
        height: 768,
    },
    physics: {
        default: "arcade",
        arcade: {
            debug: false,
            gravity: { x: 0, y: 0 }, // No gravity needed for this game
        },
    },
    input: {
        keyboard: true,
        mouse: true,
        touch: true,
        gamepad: false,
    },
    render: {
        pixelArt: false,
        antialias: true,
    },
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
