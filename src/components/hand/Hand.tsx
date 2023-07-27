import { PyCard } from "../../model";
import Card, { CARD_WIDTH } from "../card/Card"
import { Container } from '@pixi/react';

type HandProp = {
    x: number
    y: number
    cards: PyCard[]
}


// Multiple by 14 because we are overlapping each card by half in the hand and the
// last card is display entirely.
export const MAX_HAND_WIDTH = CARD_WIDTH/2*14


export default function Hand(props: HandProp) {
    const {x, y, cards} = props

    //             {[...Array(n)].map((e, i) => <Card key={i} x={i*53}/>)}
    return (
        <Container x={x} y={y}>
            {cards.map((card, index) => <Card key={index} x={index*CARD_WIDTH/2} card={card}/>)}
        </Container>
    )
}

