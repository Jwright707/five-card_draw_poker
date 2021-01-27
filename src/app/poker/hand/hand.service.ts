import {Card, rankNumber, Suit} from '../../card';
import {Injectable} from '@angular/core';
import {positiveModulo} from '../../util';

export interface HandExtractor {
  getStraight(hand: Card[]): Card[];
  getFlush(hand: Card[]): Card[];
  getFullHouse(hand: Card[]): Card[];
  getFourOfAKind(hand: Card[]): Card[];
  getStraightFlush(hand: Card[]): Card[];
  getFiveOfAKind(hand: Card[]): Card[];
  getThreeOfAKind(hand: Card[]): Card[];
  getTwoPair(hand: Card[]): Card[];
  getPair(hand: Card[]): Card[];

  /**
   * Returns the best `StrictHand`.
   * @param hand input hand
   */
  getBest(hand: Card[]): StrictHand;

  /**
   * Returns rank-sorted hand.
   * @param hand input hand
   * @param n the number of cards in the returned hand
   */
  getHighCards(hand: Card[], n: number): Card[];

  getKicker(hand: Card[], others: Card[], requiredHandLength: number): Card[];

}

export class HandUtil {
  readonly minimumHandNumber = 5;

  hasMinimumCardNumber(hand: Card[]): boolean {
    return hand.length >= this.minimumHandNumber;
  }

  /** Immutable */
  orderByRank(hand: Card[]): Card[] {
    return [...hand].sort((c1, c2) => c1.compareRank(c2));
  }
  reverseOrder(hand: Card[]): Card[] {
    return [...this.orderByRank(hand)].reverse();
  }

  /**
   * Returns a array with removed cards
   * @param hand Input hand
   * @param cards Cards to be removed
   */
  remove(hand: Card[], cards: Card[]): Card[] {
    return hand.filter(card => !cards.includes(card));
  }

}

/**
 * Hand ranked above high card, without kicker, and with metadata.
 */
export interface StrictHand {
  rank: number;
  name: string;
  cards: Card[];
}

/**
 * Returns cards strictly required the for the asked hand.
 * If the input hand has two pairs, #getTwoPair returns 4 cards, without the kicker.
 */
@Injectable({providedIn: 'root'})
export class HandService extends HandUtil implements HandExtractor {

  getPair = this.getSameOfAKind(2);
  getThreeOfAKind = this.getSameOfAKind(3);
  getFourOfAKind = this.getSameOfAKind(4);
  getFiveOfAKind = this.getSameOfAKind(5);

  getBest(hand: Card[]): StrictHand {
    const extractorFunctions = [
      this.getFiveOfAKind,
      this.getStraightFlush,
      this.getFourOfAKind,
      this.getFullHouse,
      this.getFlush,
      this.getStraight,
      this.getThreeOfAKind,
      this.getTwoPair,
      this.getPair,
      // this.getHighCards
    ];

    for (let i = 0; i < extractorFunctions.length; i++) {
      const strictExtractor = extractorFunctions[i];
      const result = strictExtractor.bind(this)(hand, this.minimumHandNumber);
      if (result) {
        return {
          rank: extractorFunctions.length - i,
          name: strictExtractor.name.slice(3).replace(/([A-Z])/g, ' $1').trim(),
          cards: result
        };
      }
    }
  }

  /**
   * Generates a function with required number of best same-rank cards
   * @param n required number of equal-rank cards
   */
  private getSameOfAKind(n: number): (hand: Card[]) => Card[] {
    return (hand: Card[]) => {
      if (hand.length < n)  return;
      const cardsGroupedByRank = hand.reduce((acc, card: Card) => {
        if (acc[card.rank]) {
          acc[card.rank].push(card);
        } else {
          acc[card.rank] = [card];
        }
        return acc;
      }, {});
      const nSameRanks = Object.keys(cardsGroupedByRank).filter(rank => cardsGroupedByRank[rank].length >= n).map(v => Number(v));
      if (!nSameRanks.length) return;
      const nSameRank = nSameRanks.reduce((acc, val) => Card.relativeOperation(acc) > Card.relativeOperation(val) ? acc : val);
      return cardsGroupedByRank[nSameRank].slice(0, n);
    };
  }

  /**
   * Extracts the straight with the highest card.
   * @param hand A hand of any number of cards.
   */
   getStraight(hand: Card[]): Card[] {
    if (!this.hasMinimumCardNumber(hand)) return;
    hand = this.reverseOrder(hand);
    const diffRange: number[] = Array.from({length: this.minimumHandNumber - 1}, (_, i) => i + 1); // [1, 2, 3, 4]
    for (let i = 0; i < hand.length - (this.minimumHandNumber - 1); i++) {
      let buffer: Card[] = [hand[i]];
      for (const diff of diffRange) {
        const lowerCard = hand[i].getLower(diff, hand);
        if (lowerCard) {
          buffer.push(lowerCard);
        } else {
          buffer = [];
          break;
        }
      }
      if (buffer.length >= this.minimumHandNumber) {
        return buffer;
      }
    }
  }

  getFlush(hand: Card[]): Card[] {
    if (!this.hasMinimumCardNumber(hand)) return;
    hand = this.reverseOrder(hand);
    for (const key in Suit) {
      if (!isNaN(Number(Suit[key]))) continue;
      const filteredHand = hand.filter(card => card.suit === Suit[key]);
      if (filteredHand.length >= this.minimumHandNumber) {
        return filteredHand.slice(0, 5);
      }
    }
  }

  getFullHouse(hand: Card[]): Card[] {
    if (hand.length < 5) return;
    const trips = this.getThreeOfAKind(hand);
    if (!trips) return;
    const pair = this.getPair(this.remove(hand, trips));
    if (!pair)  return;
    return [...trips, ...pair];
  }

  getStraightFlush(hand: Card[]): Card[] {
    if (!this.hasMinimumCardNumber(hand)) return;
    hand = this.reverseOrder(hand); // Mandatory.
    const diffRange: number[] = Array.from({length: this.minimumHandNumber - 1}, (_, i) => i + 1); // [1, 2, 3, 4]
    for (let i = 0; i < hand.length - (this.minimumHandNumber - 1); i++) {
      let buffer: Card[] = [hand[i]];
      for (const diff of diffRange) {
        const lowerCardWithSameSuit = hand.find(c => c.suit === hand[i].suit && diff === positiveModulo(hand[i].rank - c.rank, rankNumber));
        if (lowerCardWithSameSuit) {
          buffer.push(lowerCardWithSameSuit);
        } else {
          buffer = [];
          break;
        }
      }
      if (buffer.length >= this.minimumHandNumber) {
        return buffer;
      }
    }
  }

  getTwoPair(hand: Card[]): Card[] {
    if (hand.length < 4) return;
    const highestRankedPair = this.getPair(hand);
    if (!highestRankedPair) return;
    const lowestRankingPair = this.getPair(this.remove(hand, highestRankedPair));
    if (!lowestRankingPair) return;
    return [...highestRankedPair, ...lowestRankingPair];
  }

  getHighCards(hand: Card[], n: number): Card[] {
    if (!hand.length) return;
    return this.reverseOrder(hand).slice(0, n || hand.length);
  }

  getKicker(hand: Card[], combination: Card[], requiredHandLength: number): Card[] {
    if (hand.length < requiredHandLength) return;
    const withoutCombination = this.remove(hand, combination);
    return this.getHighCards(withoutCombination, requiredHandLength - combination.length);
  }

}
