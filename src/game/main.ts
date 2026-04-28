import { Boot } from "./scenes/boot";
import { Preloader } from "./scenes/preloader";
import { MainMenu } from "./scenes/main-menu";
import { Level1 } from "./scenes/level1";
import { AUTO, Game } from "phaser";
import { LevelSelect } from "./scenes/level-select";
import { Level2 } from "./scenes/level2";
//import { Level3 } from "./scenes/level3";
import { GameOver } from "./scenes/game-over";

const config: Phaser.Types.Core.GameConfig = {
    title: "Detective Code",
    version: "0.2",
    type: AUTO,
    parent: "game-container",
    backgroundColor: "#1a1a1a",
    scene: [Boot, Preloader, MainMenu, LevelSelect, Level1, Level2, GameOver],
    scale: {
        parent: "phaser-game",
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1024,
        height: 768,
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
