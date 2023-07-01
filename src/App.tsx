import React from 'react';
import * as PIXI from 'pixi.js';
import { Stage, Sprite } from '@pixi/react';
import cardImage from "./components/card/C1.png"
import Hand from './components/hand/Hand';

type CardProps = {
  x: number
  y?: number
}

export const DraggableCard = ({ x, y } : CardProps) => {
  const isDragging = React.useRef(false);
  const offset = React.useRef({ x: 0, y: 0 });
  const [position, setPosition] = React.useState({ x: x || 0, y: y || 0 })
  
  function onStart(e: any) {
    isDragging.current = true;    
    offset.current = {
      x: e.data.global.x - position.x,
      y: e.data.global.y - position.y
    };
    
  }

  function onEnd() {
    isDragging.current = false;
  }

  function onMove(e: any) {
    if (isDragging.current) {
      setPosition({
        x: e.data.global.x - offset.current.x,
        y: e.data.global.y - offset.current.y,
      })
    }
  }

  return (
    <Sprite
      position={position}
      image={cardImage}
      height={162}
      width={106}
      zIndex={1}
      interactive={true}
      pointerdown={onStart}
      pointerup={onEnd}
      pointerupoutside={onEnd}
      pointermove={onMove}
    />
  );
};

// Issue at https://github.com/pixijs/pixi-react/issues/416
console.log(PIXI.Texture.WHITE)

function App() {

  return (
    <Stage width={1280} height={720} options= {{backgroundColor: 0x5F92DE}}>
        <Hand x={10} y={542}/>
    </Stage>
  );
}


export default App;
