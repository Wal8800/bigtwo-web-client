import { Container } from '@pixi/react';
import CardBack from "../card/CardBack"
import { CARD_WIDTH } from '../card/Card';

type OpponentHandProps = {
    x: number
    y: number
    numCards: number
    rotation?: number
}
export default function OpponentHand(props: OpponentHandProps) {
    const {x, y, numCards, rotation} = props

    return (
        <Container x={x} y={y} angle={rotation}>
            {[...Array(numCards)].map((e, i) => <CardBack key={i} x={i*CARD_WIDTH/2}/>)}
        </Container>
    )
}