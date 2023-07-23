import React from 'react';
import { useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Stage } from '@pixi/react';
import Hand from './components/hand/Hand';
import { loadPyodide } from 'pyodide';
import ClipLoader from "react-spinners/ClipLoader";
import { PyCard, toPyCard } from './model';


// Issue at https://github.com/pixijs/pixi-react/issues/416
console.log(PIXI.Texture.WHITE)

function App() {
  const [loading, setLoading] = useState(true);
  const [pyodideRunTime, setPyRunTime] = useState<any | undefined>(undefined);
  const [hands, setHands] = useState<Array<Array<PyCard>>>([]);

  useEffect(() => {
    const loadApplication = async() => {
      const runTime = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
      });

      setPyRunTime(runTime)

      await runTime.loadPackage("micropip")
      const micropip = await runTime.pyimport("micropip")
      await micropip.install("numpy")
      await runTime.runPythonAsync(`
            import os
            from pyodide.http import pyfetch

            print("loading card games")
            response = await pyfetch("card-games.zip")
            await response.unpack_archive()
            print("loaded card games")
        `)

      await runTime.runPythonAsync(`
        from bigtwo.bigtwo import BigTwo

        game = BigTwo()
      `)

      const cards = runTime.globals.get('game').player_hands.get(0).cards

      const transformedCards: PyCard[] = []
      for (let card of cards) {
        transformedCards.push(toPyCard(card.suit.value, card.rank.value))
      }
      console.log(transformedCards)

      const hands: PyCard[][] = []
      hands.push(transformedCards)
      setHands(hands)
      setLoading(false)
    }
    
    loadApplication();
  }, []);

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
      <Stage width={1280} height={720} options= {{backgroundColor: 0x5F92DE}}>
        <Hand x={10} y={542} cards={hands[0]}/>
      </Stage>
    )}

    </div>

  );
}


export default App;
