import Card from "../card/Card"
import { Container } from '@pixi/react';

type HandProp = {
    x: number
    y: number
}


export default function Hand(props: HandProp) {
    const {x, y} = props

    const n = 13
    //             {[...Array(n)].map((e, i) => <Card key={i} x={i*53}/>)}
    return (
        <Container x={x} y={y}>
            {[...Array(n)].map((e, i) => <Card key={i} x={i*53}/>)}
        </Container>
    )
}

