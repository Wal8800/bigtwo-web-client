import { PyCard } from "../../model";
import Card from "../card/Card"
import { Container } from '@pixi/react';

type HandProp = {
    x: number
    y: number
    cards: PyCard[]
}


export default function Hand(props: HandProp) {
    const {x, y, cards} = props

    //             {[...Array(n)].map((e, i) => <Card key={i} x={i*53}/>)}
    return (
        <Container x={x} y={y}>
            {cards.map((card, index) => <Card key={index} x={index*53} card={card}/>)}
        </Container>
    )
}

