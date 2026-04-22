import { useRef } from "react";
import type { IRefPhaserGame } from "./PhaserGame";
import { PhaserGame } from "./PhaserGame";

function App() {
    const phaserRef = useRef<IRefPhaserGame>(null);
    return (
        <div id="app">
            <PhaserGame ref={phaserRef} />
        </div>
    );
}

export default App;
