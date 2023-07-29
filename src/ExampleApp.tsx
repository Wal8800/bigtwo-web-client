import React from 'react';
import * as PIXI from 'pixi.js';

import { Stage, Container, Sprite } from '@pixi/react'

const width = 800;
const height = 500;
const backgroundColor = 0x1d2330;

let index = 1;

type DraggableBoxProp = {
  tint: PIXI.ColorSource
  x: number
  y?: number
}

const DraggableBox = ({ tint, x, y, ...props }: DraggableBoxProp) => {
  const isDragging = React.useRef(false);
  const offset = React.useRef({ x: 0, y: 0 });
  const [position, setPosition] = React.useState({ x: x || 0, y: y || 0 })
  const [alpha, setAlpha] = React.useState(1);
  const [zIndex, setZIndex] = React.useState(index);
  
  function onStart(e: any) {
    isDragging.current = true;    
    offset.current = {
      x: e.data.global.x - position.x,
      y: e.data.global.y - position.y
    };
    
    setAlpha(0.5);
    setZIndex(index++);
  }

  function onEnd() {
    isDragging.current = false;
    setAlpha(1);
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
      {...props}
      alpha={alpha}
      position={position}
      texture={PIXI.Texture.WHITE}
      width={100}
      height={100}
      zIndex={zIndex}
      tint={tint}
      interactive={true}
      pointerdown={onStart}
      pointerup={onEnd}
      pointerupoutside={onEnd}
      pointermove={onMove}
    />
  );
};

const ExampleApp = () => {
  return (
    <Stage width={width} height={height} options={{ backgroundColor }}>
      <Container sortableChildren={true}>
        <DraggableBox tint={0xff00ff} x={0} />
        <DraggableBox tint={0x00ffff} x={100} />
        <DraggableBox tint={0x00ff00} x={200} />
      </Container>
    </Stage>
  );
};

export default ExampleApp;
