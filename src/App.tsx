import { useEffect, useState } from "react";
import * as PIXI from "pixi.js";
import { Sprite, Stage } from "@pixi/react";
import Hand, { MAX_HAND_WIDTH } from "./components/hand/Hand";
import { loadPyodide } from "pyodide";
import type { PyCallable, PyProxy, PyProxyWithGet } from "pyodide/ffi";
import * as tf from "@tensorflow/tfjs";
import ClipLoader from "react-spinners/ClipLoader";
import {
  PyCard,
  Rank,
  SelectablePyCard,
  Suit,
  getCardImagePath,
  toPyCard,
} from "./model";
import OpponentHand from "./components/hand/OpponentHand";
import { CARD_HEIGHT } from "./components/card/Card";
import LastPlayedCards from "./components/hand/LastPlayedCards";

// Issue at https://github.com/pixijs/pixi-react/issues/416
console.log(PIXI.Texture.WHITE);

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const STAGE_PADDING = 50;

const DEFAULT_PLAYER_ID = 0;

const PLAY_BUTTON_URL = "custom_images/play_button.png";
const SKIP_BUTTON_URL = "custom_images/skip_button.png";
const HOW_TO_PLAY_BUTTON_URL = "custom_images/how_to_play.png";

const HOW_TO_PLAY_README_URL =
  "https://github.com/Wal8800/bigtwo-web-client/blob/main/how_to_play.md";

type PyEnv = {
  game: PyProxy;
  obsToOhe: PyCallable;
  generateActionMask: PyCallable;
  toCard: PyCallable;
  runStep: PyCallable;
  rawActionToCat: PyProxyWithGet;
  catToRawAction: PyProxyWithGet;
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

  return finalOutput.argMax().arraySync();
};

const playBot = function (
  pyEnv: PyEnv,
  obs: PyProxy,
  model: any
): [PyProxy, boolean] {
  const ohe = pyEnv.obsToOhe(obs).tolist();
  const mask = pyEnv.generateActionMask(pyEnv.rawActionToCat, obs);

  const cat = predictAction(
    model,
    ohe.toJs({ create_proxies: false }),
    mask.toJs({ create_proxies: false })
  );

  ohe.destroy();
  mask.destroy();

  const rawAction = pyEnv.catToRawAction.get(cat);
  const action = [];
  let index = 0;
  for (let card of obs.your_hands.cards) {
    if (rawAction.get(index) === 1) {
      action.push(card);
    }

    index++;
  }

  const [updatedObs, done] = pyEnv.runStep(pyEnv.game, action);

  updatedObs.destroy();
  rawAction.destroy();

  const nextPlayerObs = pyEnv.game.get_current_player_obs();
  return [nextPlayerObs, done];
};

const resetAndStart = function (pyEnv: PyEnv, model: any) {
  let obs = pyEnv.game.reset();
  while (true) {
    if (obs.current_player === DEFAULT_PLAYER_ID) {
      return obs;
    }

    let [nextPlayerObs, done] = playBot(pyEnv, obs, model);
    if (done) {
      throw new Error("Unexpected game to be done within the first round");
    }

    obs = nextPlayerObs;
  }
};

const step = function (
  pyEnv: PyEnv,
  model: any,
  selectedCards: Array<SelectablePyCard>
): [PyProxy, boolean] {
  const action: PyProxy[] = [];
  for (let card of selectedCards) {
    action.push(pyEnv.toCard(card.value.suit, card.value.rank));
  }

  let [obs, done] = pyEnv.runStep(pyEnv.game, action);
  if (done) {
    return [obs, done];
  }

  // Python bigtwo game's step returns the current player obs instead of the next player
  // needs to call get_current_player_obs.
  obs = pyEnv.game.get_current_player_obs();
  while (true) {
    if (obs.current_player === DEFAULT_PLAYER_ID) {
      return [obs, false];
    }

    let [nextPlayerObs, done] = playBot(pyEnv, obs, model);

    // Game finished, won by one of the bots, returns the current observation for the player.
    if (done) {
      return [pyEnv.game.get_player_obs(DEFAULT_PLAYER_ID), true];
    }

    obs = nextPlayerObs;
  }
};

enum SortBy {
  NoSort,
  Suit,
  Rank,
}

const getSortByFunc = (sortBy: SortBy) => {
  const rankOrder = Object.values(Rank);
  const suitOrder = Object.values(Suit);
  switch (sortBy) {
    case SortBy.NoSort:
      return (a: SelectablePyCard, b: SelectablePyCard) => {
        return 0;
      };
    case SortBy.Rank:
      return (a: SelectablePyCard, b: SelectablePyCard) => {
        const result =
          rankOrder.indexOf(a.value.rank) - rankOrder.indexOf(b.value.rank);

        if (result !== 0) {
          return result;
        }

        return (
          suitOrder.indexOf(a.value.suit) - suitOrder.indexOf(b.value.suit)
        );
      };
    case SortBy.Suit:
      return (a: SelectablePyCard, b: SelectablePyCard) => {
        const result =
          suitOrder.indexOf(a.value.suit) - suitOrder.indexOf(b.value.suit);

        if (result !== 0) {
          return result;
        }

        return (
          rankOrder.indexOf(a.value.rank) - rankOrder.indexOf(b.value.rank)
        );
      };
    default:
      throw new Error(`unexpected sort by: ${sortBy}`);
  }
};

const preloadCardImages = () => {
  Object.values(Rank).forEach((rank) => {
    Object.values(Suit).forEach((suit) => {
      new Image().src = getCardImagePath(suit, rank);
    });
  });
};

function App() {
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>(SortBy.NoSort);
  const [playing, setPlaying] = useState(false);

  const [model, setModel] = useState<tf.GraphModel>();
  const [pyEnv, setPyEnv] = useState<PyEnv>();

  const [hand, setHand] = useState<Array<SelectablePyCard>>([]);
  const [numOpponentCard, setNumOpponentCards] = useState<Array<number>>([
    13, 13, 13,
  ]);
  const [lastPlayedCards, setLastPlayed] = useState<Array<PyCard>>([]);

  const [playImage, setPlayImage] = useState(SKIP_BUTTON_URL);

  const updateState = (obs: PyProxy, sortBy: SortBy) => {
    const cards = obs.your_hands.cards;

    const transformedCards: SelectablePyCard[] = [];
    for (let card of cards) {
      transformedCards.push({
        value: toPyCard(card.suit.value, card.rank.value),
        isSelected: false,
      });

      card.destroy();
    }

    const lastPlayedCards: PyCard[] = [];
    for (let card of obs.last_cards_played) {
      lastPlayedCards.push(toPyCard(card.suit.value, card.rank.value));
      card.destroy();
    }

    setNumOpponentCards(
      obs.num_card_per_player.toJs({ create_proxies: false })
    );
    setLastPlayed(lastPlayedCards);
    const compareFunc = getSortByFunc(sortBy);
    setHand(transformedCards.slice().sort(compareFunc));

    cards.destroy();
  };

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

      const response = await fetch("card-games.zip");
      const buffer = await response.arrayBuffer();
      await runTime.unpackArchive(buffer, "zip");

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

      const game = runTime.globals.get("game");
      const catToRawAction = runTime.globals.get("cat_to_raw_action");
      const rawActionToCat = runTime.globals.get("raw_action_to_cat");
      const generateActionMask = runTime.globals.get("generate_action_mask");
      const obsToOhe = runTime.globals.get("obs_to_ohe");
      const toCard = runTime.globals.get("to_card");
      const runStep = runTime.globals.get("run_step");

      const pyEnv = {
        game,
        catToRawAction,
        rawActionToCat,
        generateActionMask,
        obsToOhe,
        toCard,
        runStep,
      };
      setPyEnv(pyEnv);

      const obs = resetAndStart(pyEnv, model);
      updateState(obs, SortBy.NoSort);

      setLoading(false);

      // Clean up any PyProxy we don't need
      obs.destroy();
    };

    preloadCardImages();

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
        pyEnv.toCard.destroy();
        pyEnv.runStep.destroy();
      }
    };

    window.addEventListener("beforeunload", cleanUp);

    return () => {
      window.removeEventListener("beforeunload", cleanUp);
    };
  }, [pyEnv]);

  useEffect(() => {
    const hasSelected = hand.some((card) => {
      return card.isSelected;
    });

    if (hasSelected) {
      setPlayImage(PLAY_BUTTON_URL);
    } else {
      setPlayImage(SKIP_BUTTON_URL);
    }
  }, [hand]);

  const onSortBy = (sortBy: SortBy) => {
    return (event: any) => {
      const compareFunc = getSortByFunc(sortBy);
      const sortedHand = hand
        .map((card) => {
          return {
            value: card.value,
            isSelected: false,
          };
        })
        .sort(compareFunc);

      setSortBy(sortBy);
      setHand(sortedHand);
    };
  };

  const openHowToPlay = (event: any) => {
    window.open(HOW_TO_PLAY_README_URL);
  };

  const onPlay = (event: any) => {
    if (playing) {
      return;
    }

    if (!pyEnv) {
      throw new Error("Expected python environment to be ready");
    }

    setPlaying(true);

    let action: Array<SelectablePyCard> = hand.filter(
      (card) => card.isSelected
    );

    const prevLastPlayedCards: PyCard[] = [];
    for (let card of pyEnv.game.get_current_player_obs().last_cards_played) {
      prevLastPlayedCards.push(toPyCard(card.suit.value, card.rank.value));
      card.destroy();
    }

    const [obs, done] = step(pyEnv, model, action);
    if (done) {
      updateState(obs, sortBy);
      if (obs.your_hands.cards.length) {
        alert("You Lost");
      } else {
        alert("You won");
      }

      const newObs = resetAndStart(pyEnv!!, model);
      updateState(newObs, sortBy);

      newObs.destroy();
      setPlaying(false);
      return;
    }

    const currLastPlayedCards: PyCard[] = [];
    for (let card of obs.last_cards_played) {
      currLastPlayedCards.push(toPyCard(card.suit.value, card.rank.value));
      card.destroy();
    }

    if (
      JSON.stringify(prevLastPlayedCards) ===
      JSON.stringify(currLastPlayedCards)
    ) {
      alert("You played an invalid combination, please select again.");
    } else {
      updateState(obs, sortBy);
      obs.destroy();
    }

    setPlaying(false);
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

          {/* how to play button*/}
          <Sprite
            x={(STAGE_WIDTH - MAX_HAND_WIDTH) / 2 - 20 - 122}
            y={STAGE_HEIGHT - CARD_HEIGHT - STAGE_PADDING}
            height={52}
            width={122}
            interactive={true}
            image={process.env.PUBLIC_URL + HOW_TO_PLAY_BUTTON_URL}
            pointerdown={openHowToPlay}
          />

          {/* play button */}
          <Sprite
            x={(STAGE_WIDTH - MAX_HAND_WIDTH) / 2 + MAX_HAND_WIDTH + 20}
            y={STAGE_HEIGHT - CARD_HEIGHT - STAGE_PADDING}
            height={52}
            width={122}
            interactive={true}
            image={process.env.PUBLIC_URL + playImage}
            pointerdown={onPlay}
          />

          {/* sort by rank button */}
          <Sprite
            x={(STAGE_WIDTH - MAX_HAND_WIDTH) / 2 + MAX_HAND_WIDTH + 20}
            y={STAGE_HEIGHT - CARD_HEIGHT - STAGE_PADDING + 80}
            height={38}
            width={38}
            interactive={true}
            image={process.env.PUBLIC_URL + "custom_images/sort_by_rank.png"}
            pointerdown={onSortBy(SortBy.Rank)}
          />

          {/* sort by suit button */}
          <Sprite
            x={(STAGE_WIDTH - MAX_HAND_WIDTH) / 2 + MAX_HAND_WIDTH + 70}
            y={STAGE_HEIGHT - CARD_HEIGHT - STAGE_PADDING + 80}
            height={38}
            width={38}
            interactive={true}
            image={process.env.PUBLIC_URL + "custom_images/sort_by_suit.png"}
            pointerdown={onSortBy(SortBy.Suit)}
          />
        </Stage>
      )}
    </div>
  );
}

export default App;
