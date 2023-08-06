import { useEffect, useState } from "react";
import * as PIXI from "pixi.js";
import { Sprite, Stage } from "@pixi/react";
import Hand, { MAX_HAND_WIDTH } from "./components/hand/Hand";
import { loadPyodide } from "pyodide";
import type { PyCallable, PyProxy, PyProxyWithGet } from "pyodide/ffi";
import * as tf from "@tensorflow/tfjs";
import ClipLoader from "react-spinners/ClipLoader";
import { PyCard, SelectablePyCard, toPyCard } from "./model";
import OpponentHand from "./components/hand/OpponentHand";
import { CARD_HEIGHT } from "./components/card/Card";
import LastPlayedCards from "./components/hand/LastPlayedCards";

// Issue at https://github.com/pixijs/pixi-react/issues/416
console.log(PIXI.Texture.WHITE);

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const STAGE_PADDING = 50;

const DEFAULT_PLAYER_ID = 0;

type PyEnv = {
  game: PyProxy
  obsToOhe: PyCallable
  generateActionMask: PyCallable
  toCard: PyCallable
  runStep: PyCallable
  rawActionToCat: PyProxyWithGet
  catToRawAction: PyProxyWithGet
};

const predictAction = function (
  model: tf.GraphModel,
  inputs: number[],
  mask: number[]
): any {
  const inputTensor = tf.tensor(inputs).reshape([1, -1]);

  // The model returns two output tensor in an array.
  const output = model.predict({
    observations: inputTensor,
  }) as tf.Tensor<tf.Rank>[];

  const infMask = tf.tensor(1).sub(tf.tensor(mask)).mul(tf.scalar(-1e9));
  const finalOutput = output[0].squeeze().add(infMask);

  const cat = finalOutput.argMax().arraySync();
  return cat;
};

const playBot = function(
  pyEnv: PyEnv,
  obs: PyProxy,
  model: any,): [PyProxy, boolean] {
  const ohe = pyEnv.obsToOhe(obs).tolist();
  const mask = pyEnv.generateActionMask(pyEnv.rawActionToCat, obs);

  const cat = predictAction(
    model,
    ohe.toJs({ create_proxies: false }),
    mask.toJs({ create_proxies: false })
  );

  ohe.destroy()
  mask.destroy()

  const rawAction = pyEnv.catToRawAction.get(cat);
  const action = []
  let index = 0
  for (let card of obs.your_hands.cards) {
    if (rawAction.get(index) === 1) {
      action.push(card);
    }

    index++
  }

  const [updatedObs, done] = pyEnv.runStep(pyEnv.game, action)

  updatedObs.destroy()
  rawAction.destroy()

  const nextPlayerObs = pyEnv.game.get_current_player_obs()
  return [nextPlayerObs, done]
}

const resetAndStart = function (pyEnv: PyEnv, model: any) {
  let obs = pyEnv.game.reset();
  while (true) {
    if (obs.current_player === DEFAULT_PLAYER_ID) {
      return obs;
    }

    let [nextPlayerObs, done] = playBot(pyEnv, obs, model)
    if (done) {
      throw new Error("Unexpected game to be done within the first round")
    }

    obs = nextPlayerObs
  }
};

const step = function (
  pyEnv: PyEnv,
  model: any,
  selectedCards: Array<SelectablePyCard>
): [PyProxy, boolean] {
  console.log("selectedCards", selectedCards) 
  const action: PyProxy[] = []
  for (let card of selectedCards) {
    action.push(pyEnv.toCard(card.value.suit, card.value.rank))
  }

  let [obs, done] = pyEnv.runStep(pyEnv.game, action)
  if (done) {
    return [obs, done];
  }

  // Python bigtwo game's step returns the current player obs instead of the next player
  // needs to call get_current_player_obs.
  obs = pyEnv.game.get_current_player_obs()
  while (true) {
    if (obs.current_player === DEFAULT_PLAYER_ID) {
      return [obs, false];
    }

    let [nextPlayerObs, done] = playBot(pyEnv, obs, model)

    // Game finished, won by one of the bots, returns the current observation for the player.
    if (done) {
      return [pyEnv.game.get_player_obs(DEFAULT_PLAYER_ID), true]
    }

    obs = nextPlayerObs
  }
};

function App() {
  const [loading, setLoading] = useState(true);

  const [playing, setPlaying] = useState(false);

  const [model, setModel] = useState<tf.GraphModel>();
  const [pyEnv, setPyEnv] = useState<PyEnv>();

  const [hand, setHand] = useState<Array<SelectablePyCard>>([]);
  const [numOpponentCard, setNumOpponentCards] = useState<Array<number>>([
    13, 13, 13,
  ]);
  const [lastPlayedCards, setLastPlayed] = useState<Array<PyCard>>([]);

  const updateState = (obs: PyProxy) => {
    const cards = obs.your_hands.cards;

    const transformedCards: SelectablePyCard[] = [];
    for (let card of cards) {
      transformedCards.push({
        value: toPyCard(card.suit.value, card.rank.value),
        isSelected: false,
      });

      card.destroy()
    }

    const lastPlayedCards: PyCard[] = [];
    for (let card of obs.last_cards_played) {
      lastPlayedCards.push(toPyCard(card.suit.value, card.rank.value));

      card.destroy()
    }

    setNumOpponentCards(
      obs.num_card_per_player.toJs({ create_proxies: false })
    );
    setLastPlayed(lastPlayedCards);
    setHand(transformedCards);

    cards.destroy();
  }

  useEffect(() => {
    const loadApplication = async () => {
      const model = await tf.loadGraphModel("webmodel/model.json");
      setModel(model);

      const runTime = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
      });

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

      // Initialising global python variables that we will be using.
      await runTime.runPythonAsync(`
        from bigtwo.bigtwo import BigTwo
        from bigtwo.preprocessing import (
          create_action_cat_mapping,
          generate_action_mask,
          obs_to_ohe,
        )
        from playingcards.card import Card, Rank, Suit

        game = BigTwo()
        cat_to_raw_action, raw_action_to_cat = create_action_cat_mapping()

        def run_step(env: BigTwo, js_proxy):
            action = js_proxy.to_py()
            return env.step(action)

        def to_card(suit: str, rank: str)-> Card:
            return Card(Suit(suit), Rank(rank))
      `);

      const game = runTime.globals.get("game")
      const catToRawAction = runTime.globals.get("cat_to_raw_action")
      const rawActionToCat = runTime.globals.get("raw_action_to_cat")
      const generateActionMask = runTime.globals.get("generate_action_mask")
      const obsToOhe = runTime.globals.get("obs_to_ohe")
      const toCard = runTime.globals.get("to_card")
      const runStep = runTime.globals.get("run_step")

      const pyEnv = {
        game,
        catToRawAction,
        rawActionToCat,
        generateActionMask,
        obsToOhe,
        toCard,
        runStep
      };
      setPyEnv(pyEnv);

      const obs = resetAndStart(pyEnv, model);
      updateState(obs)

      setLoading(false)

      // Clean up any PyProxy we don't need
      obs.destroy();
    };

    loadApplication();
  }, []);

  useEffect(() => {
    const cleanUp = () => {
      if (pyEnv !== undefined) {
        pyEnv.game.destroy();
        pyEnv.catToRawAction.destroy();
        pyEnv.rawActionToCat.destroy();
        pyEnv.obsToOhe.destroy();
        pyEnv.generateActionMask.destroy();
      }
    };

    window.addEventListener("beforeunload", cleanUp);

    return () => {
      window.removeEventListener("beforeunload", cleanUp);
    };
  }, [pyEnv]);

  const bunny =
    "https://s3-us-west-2.amazonaws.com/s.cdpn.io/693612/IaUrttj.png";

  const onPlay = (event: any) => {
    console.log("clicked play", playing)
    if (playing) {
      return;
    }

    setPlaying(true);
    
    let action: Array<SelectablePyCard> = hand.filter((card) => card.isSelected );
    const [obs, done] = step(pyEnv!!, model, action);
    if (done) {
      updateState(obs)
      if (obs.your_hands.cards.length) {
        alert("You Lost");
      } else {
        alert("You won");
      }

      const newObs = resetAndStart(pyEnv!!, model);
      updateState(newObs)

      newObs.destroy()
      return;
    }

    updateState(obs)

    obs.destroy()
    setPlaying(false)
  };

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
          {/* last played cards */}
          <LastPlayedCards
            x={(STAGE_WIDTH - MAX_HAND_WIDTH) / 2}
            y={STAGE_HEIGHT / 2 - CARD_HEIGHT / 2}
            cards={lastPlayedCards}
          />

          {/* player hand */}
          <Hand
            x={(STAGE_WIDTH - MAX_HAND_WIDTH) / 2}
            y={STAGE_HEIGHT - CARD_HEIGHT - STAGE_PADDING}
            cards={hand}
            onSelect={setHand}
          />

          {/* left hand */}
          <OpponentHand
            x={STAGE_PADDING + CARD_HEIGHT}
            y={(STAGE_HEIGHT - MAX_HAND_WIDTH) / 2}
            numCards={numOpponentCard[0]}
            rotation={90}
          />

          {/* top hand */}
          <OpponentHand
            x={(STAGE_WIDTH - MAX_HAND_WIDTH) / 2 + MAX_HAND_WIDTH}
            y={CARD_HEIGHT + STAGE_PADDING}
            numCards={numOpponentCard[1]}
            rotation={180}
          />

          {/* right hand */}
          <OpponentHand
            x={STAGE_WIDTH - STAGE_PADDING - CARD_HEIGHT}
            y={STAGE_PADDING + MAX_HAND_WIDTH}
            numCards={numOpponentCard[2]}
            rotation={270}
          />

          {/* play button */}
          <Sprite
            x={(STAGE_WIDTH - MAX_HAND_WIDTH) / 2 + MAX_HAND_WIDTH + 25}
            y={STAGE_HEIGHT - CARD_HEIGHT - STAGE_PADDING}
            anchor={[0.5, 0.5]}
            interactive={true}
            image={bunny}
            pointerdown={onPlay}
          />
        </Stage>
      )}
    </div>
  );
}

export default App;
