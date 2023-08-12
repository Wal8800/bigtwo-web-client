import { Sprite } from "@pixi/react"
import React from 'react';
import { PyCard, getCardImagePath } from "../../model";


type CardProps = {
    x: number
    y?: number
    card: PyCard
    isSelected?: boolean
    onSelect?: (isSelected: boolean) => void
}

export const CARD_WIDTH = 84
export const CARD_HEIGHT = 128


function Card({ x, y, card, isSelected, onSelect } : CardProps) {
    const [position, setPosition] = React.useState({ x: x || 0, y: y || 0 })
    const selectedOffset = 30

    const onPointerDown = (event: any) => {
        setPosition({
            x: position.x,
            y: isSelected ? position.y + selectedOffset : position.y - selectedOffset
          })
        isSelected = !isSelected

        onSelect?.(isSelected)
    }

    const imagePath = getCardImagePath(card.suit, card.rank)

    if (onSelect === undefined) {
      return (
        <Sprite
        image={imagePath}
        height={CARD_HEIGHT}
        width={CARD_WIDTH}
        position={position}
      />
      )
    }

    return (
        <Sprite
        image={imagePath}
        height={CARD_HEIGHT}
        width={CARD_WIDTH}
        position={position}
        interactive={true}
        pointerdown={onPointerDown}
      />
    );
}

export default Card
