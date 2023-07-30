import { SelectablePyCard } from "../../model";
import Card, { CARD_WIDTH } from "../card/Card";
import { Container } from "@pixi/react";

type HandProp = {
  x: number
  y: number
  cards: SelectablePyCard[]
  onSelect: (cards: SelectablePyCard[]) => void
};

// Multiple by 14 because we are overlapping each card by half in the hand and the
// last card is display entirely.
export const MAX_HAND_WIDTH = (CARD_WIDTH / 2) * 14;

export default function Hand(props: HandProp) {
  const { x, y, cards, onSelect } = props;

  const handleCardSelect = (idx: number, isSelected: boolean) => {
    const updatedSelected = cards.map((card, index) =>
      idx === index ? {value: card.value, isSelected} : card
    );

    onSelect(updatedSelected);
  };

  return (
    <Container x={x} y={y}>
      {cards.map((card, index) => (
        <Card 
        key={`${index}_${card.value.rank}_${card.value.suit}`}
        x={(index * CARD_WIDTH) / 2}
        isSelected={card.isSelected}
        onSelect={(isSelected: boolean) => handleCardSelect(index, isSelected)}
        card={card.value} />
      ))}
    </Container>
  );
}
