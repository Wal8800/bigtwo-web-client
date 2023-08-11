import { Sprite } from "@pixi/react"
import React from 'react';
import { CARD_HEIGHT, CARD_WIDTH } from "./Card";

type CardBackProps = {
    x: number
    y?: number
}

export default function CardBack({x, y}: CardBackProps) {
    const position = { x: x || 0, y: y || 0 }

    return (
        <Sprite
        image={process.env.PUBLIC_URL + 'images/BLUE_BACK.svg.png'}
        height={CARD_HEIGHT}
        width={CARD_WIDTH}
        position={position}
        />
    )
}