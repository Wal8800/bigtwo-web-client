enum Suit {
    DIAMOND = "♦",
    CLUB  = "♣",
    HEART = "♥",
    SPADE = "♠"
}
  
enum Rank {
    THREE = "3",
    FOUR = "4",
    FIVE = "5",
    SIX = "6",
    SEVEN = "7",
    EIGHT = "8",
    NINE = "9",
    TEN = "10",
    JACK = "J",
    QUEEN = "Q",
    KING = "K",
    ACE = "A",
    TWO = "2",
}
  
  
export type PyCard = {
    rank: Rank
    suit: Suit
}

export type SelectablePyCard = {
  value: PyCard
  isSelected: boolean
}

  function toSuit(suit: String): Suit {
    switch(suit) {
      case "♠":
        return Suit.SPADE
      case "♥":
        return Suit.HEART
      case "♣":
        return Suit.CLUB
      case "♦":
        return Suit.DIAMOND
      default:
        throw new Error(`unexpected suit value: ${suit}`)
    }
  }
  
  function toRank(rank: String): Rank {
    switch(rank) {
      case "A":
        return Rank.ACE
      case "2":
        return Rank.TWO
      case "3":
        return Rank.THREE
      case "4":
        return Rank.FOUR
      case "5":
        return Rank.FIVE
      case "6":
        return Rank.SIX
      case "7":
        return Rank.SEVEN
      case "8":
        return Rank.EIGHT
      case "9":
        return Rank.NINE
      case "10":
        return Rank.TEN
      case "J":
        return Rank.JACK
      case "Q":
        return Rank.QUEEN
      case "K":
        return Rank.KING
      default:
        throw new Error(`unexpected rank value: ${rank}`)
    }
  }
  
  function toPyCard(suit: String, rank: String): PyCard {
    return { rank: toRank(rank), suit: toSuit(suit)}
  }
  
export { Suit, Rank, toPyCard }
