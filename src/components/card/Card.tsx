import { Sprite } from "@pixi/react"
import React from 'react';
import { PyCard, Suit } from "../../model";


type CardProps = {
    x: number
    y?: number
    card: PyCard
}

export const CARD_WIDTH = 84
export const CARD_HEIGHT = 128

function toImageSuit(suit: Suit): String{
  switch (suit) {
    case Suit.SPADE:
      return "S"
    case Suit.HEART:
      return "H"
    case Suit.CLUB:
      return "C"
    case Suit.DIAMOND:
      return "D"
    default:
      throw new Error(`unexpected suit: ${suit}`)
  }
}

function Card({ x, y, card } : CardProps) {
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

    const imageName = `/images/${card.rank}${toImageSuit(card.suit)}.svg.png`

    return (
        <Sprite
        image={process.env.PUBLIC_URL + imageName}
        height={CARD_HEIGHT}
        width={CARD_WIDTH}
        position={position}
        interactive={true}
        pointerdown={onPointerDown}
      />
    );
}

export default Card
