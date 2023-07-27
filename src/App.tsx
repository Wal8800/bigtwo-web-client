import { useEffect, useState } from "react";
import * as PIXI from "pixi.js";
import { Sprite, Stage } from "@pixi/react";
import Hand, { MAX_HAND_WIDTH } from "./components/hand/Hand";
import { loadPyodide } from "pyodide";
import ClipLoader from "react-spinners/ClipLoader";
import { PyCard, toPyCard } from "./model";
import OpponentHand from "./components/hand/OpponentHand";
import { CARD_HEIGHT } from "./components/card/Card";

// Issue at https://github.com/pixijs/pixi-react/issues/416
console.log(PIXI.Texture.WHITE);

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const STAGE_PADDING = 50;

function App() {
  const [loading, setLoading] = useState(true);
  const [pyodideRunTime, setPyRunTime] = useState<any | undefined>(undefined);
  const [hands, setHands] = useState<Array<Array<PyCard>>>([]);

  useEffect(() => {
    const loadApplication = async () => {
      const runTime = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
      });

      setPyRunTime(runTime);

      await runTime.loadPackage("micropip");
      const micropip = await runTime.pyimport("micropip");
      await micropip.install("numpy");
      await runTime.runPythonAsync(`
            import os
            from pyodide.http import pyfetch

            print("loading card games")
            response = await pyfetch("card-games.zip")
            await response.unpack_archive()
            print("loaded card games")
        `);

      await runTime.runPythonAsync(`
        from bigtwo.bigtwo import BigTwo

        game = BigTwo()
      `);

      const cards = runTime.globals.get("game").player_hands.get(0).cards;

      const transformedCards: PyCard[] = [];
      for (let card of cards) {
        transformedCards.push(toPyCard(card.suit.value, card.rank.value));
      }

      const hands: PyCard[][] = [];
      hands.push(transformedCards);
      setHands(hands);
      setLoading(false);
    };

    loadApplication();
  }, []);

  const bunny = "https://s3-us-west-2.amazonaws.com/s.cdpn.io/693612/IaUrttj.png";

  return (
    <div>
      <ClipLoader
        color="#be5353"
        loading={loading}
        size={150}
        aria-label="Loading Spinner"
        data-testid="loader"
      />

      {!loading && (
        <Stage
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          options={{ backgroundColor: 0x5f92de }}
        >
          {/* player hand */}
          <Hand
            x={(STAGE_WIDTH - MAX_HAND_WIDTH) / 2}
            y={STAGE_HEIGHT - CARD_HEIGHT - STAGE_PADDING}
            cards={hands[0]}
          />

          {/* left hand */}
          <OpponentHand
            x={STAGE_PADDING + CARD_HEIGHT}
            y={(STAGE_HEIGHT - MAX_HAND_WIDTH) / 2}
            numCards={13}
            rotation={90}
          />

          {/* top hand */}
          <OpponentHand
            x={((STAGE_WIDTH - MAX_HAND_WIDTH) / 2) + MAX_HAND_WIDTH}
            y={CARD_HEIGHT + STAGE_PADDING}
            numCards={13}
            rotation={180}
          />

          {/* right hand */}
          <OpponentHand
            x={STAGE_WIDTH - STAGE_PADDING - CARD_HEIGHT}
            y={STAGE_PADDING + MAX_HAND_WIDTH}
            numCards={13}
            rotation={270}
          />

        <Sprite
            x={((STAGE_WIDTH - MAX_HAND_WIDTH) / 2) + MAX_HAND_WIDTH + 25}
            y={STAGE_HEIGHT - CARD_HEIGHT - STAGE_PADDING}
            anchor={[0.5, 0.5]}
            interactive={true}
            image={bunny}
          />
        </Stage>
      )}
    </div>
  );
}

export default App;
