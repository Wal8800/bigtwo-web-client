import { Sprite } from "@pixi/react"
import cardImage from "./C1.png"
import React from 'react';

type CardProps = {
    x: number
    y?: number
}

function Card({ x, y } : CardProps) {
    const isSelected = React.useRef(false);
    const [position, setPosition] = React.useState({ x: x || 0, y: y || 0 })
    const selectedOffset = 30

    const onPointerDown = (event: any) => {
        setPosition({
            x: position.x,
            y: isSelected.current ? position.y + selectedOffset : position.y - selectedOffset
          })
        isSelected.current = !isSelected.current
    }


    return (
        <Sprite
        image={cardImage}
        height={162}
        width={106}
        position={position}
        interactive={true}
        pointerdown={onPointerDown}
      />
    );
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
        zIndex={2}
        interactive={true}
        pointerdown={onStart}
        pointerup={onEnd}
        pointerupoutside={onEnd}
        pointermove={onMove}
      />
    );
  };

export default Card
