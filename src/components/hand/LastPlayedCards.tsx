import { Container } from "@pixi/react";
import Card, { CARD_WIDTH } from "../card/Card";
import { PyCard } from "../../model";

type LastPlayedCardsProps = {
  x: number;
  y: number;
  cards: PyCard[];
};
export default function LastPlayedCards(props: LastPlayedCardsProps) {
  const { x, y, cards } = props;

  return (
    <Container x={x} y={y}>
      {cards.map((card, index) => (
        <Card
          key={index}
          x={(index * CARD_WIDTH) / 2}
          card={card}
        />
      ))}
    </Container>
  );
}
