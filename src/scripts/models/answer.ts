﻿import { Message } from './message';
import { Highlight } from './highlight';
import { ISettings } from '../services/settings';
import { Evaluation } from './enums';
import { Levensthein } from '../../lib/levenshtein';

/**
 * Represents a possible answer the content author enters for a blank, e.g. the correct or an incorrect answer.
 */
export class Answer {
  /**
   * The alternatives are equivalent strings that the library should treat the same way, e.g. show the same feedback. 
   */
  alternatives: string[];
  
  /**
   * This is the message that is displayed when the answer was entered by the user.
   */
  message: Message;
  
  /**
   * Is true if the expected text for this answer is empty.
   */
  appliesAlways: boolean;
  
  /**
   * @param  {string} answerText - The expected answer. Alternatives are separated by | or ; . (e.g. "Alternative 1|Alternative 2|Alternative 3|..."  -or- "Alternative 1;Alternative 2;Alternative 3")
   * @param  {string} reaction - The tooltip that should be displayed. Format: Tooltip Text;!!-1!! !!+1!!
   */
  constructor(answerText: string, reaction: string, private settings: ISettings) {
    this.alternatives = answerText.split(/[;|]/).map(s => s.trim());
    this.message = new Message(reaction);
    if (answerText.trim() === "") {
      this.appliesAlways = true;
    } else {
      this.appliesAlways = false;
    }
  }

  linkHighlightIdsToObjects = (highlightsBefore: Highlight[], highlightsAfter: Highlight[]) => {
    this.message.linkHighlights(highlightsBefore, highlightsAfter);
  }

  activateHighlights = () => {
    for (var highlightedObject of this.message.highlightedElements) {
      highlightedObject.isHighlighted = true;
    }
  }

  private getCleanedText(text: string) {
    if (this.settings.caseSensitive == false)
      return text.toLocaleLowerCase();
    else
      return text;
  }

  public evaluateEnteredText(enteredText: string): Evaluation {
    var cleanedEnteredText = this.getCleanedText(enteredText);

    var acceptableTypoCount: number;
    if (this.settings.warnSpellingErrors)
      acceptableTypoCount = Math.floor(enteredText.length / 10) + 1;
    else
      acceptableTypoCount = 0;

    var bestEvaluation: Evaluation = Evaluation.NoMatch;

    for (var alternative of this.alternatives) {
      var cleanedAlternative = this.getCleanedText(alternative);

      if (cleanedAlternative == cleanedEnteredText)
        return Evaluation.ExactMatch;

      var necessaryChanges = Levensthein.getEditDistance(cleanedEnteredText, cleanedAlternative);
      if (necessaryChanges <= acceptableTypoCount)
        bestEvaluation = Evaluation.CloseMatch;
    }

    return bestEvaluation;
  }
}