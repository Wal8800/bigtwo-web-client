import { Container } from "@pixi/react";
import Card, { CARD_WIDTH } from "../card/Card";
import { PyCard, Rank } from "../../model";

type LastPlayedCardsProps = {
  x: number;
  y: number;
  cards: PyCard[];
};
export default function LastPlayedCards(props: LastPlayedCardsProps) {
  const { x, y, cards } = props;
  const rankOrder = Object.values(Rank)

  const sortedCards = cards.sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))

  return (
    <Container x={x} y={y}>
      {sortedCards.map((card, index) => (
        <Card
          key={index}
          x={(index * CARD_WIDTH) / 2}
          card={card}
        />
      ))}
    </Container>
  );
}
