import ISAACContent from './h5p-isaac-content';
import { ISAACTask, uploadTask } from './h5p-isaac-interaction';
const UPLOAD_TASK_DATA = true;

/**
 * - Extends H5P.Question which offers functions for setting the DOM
 * - Implements the question type contract necessary for reporting and for
 *   making the content type usable in compound content types like Question Set
 *   Cpm. https://h5p.org/documentation/developers/contracts
 * - Implements getCurrentState to allow continuing a user's previous session
 */
export default class ISAAC extends H5P.Question {
  /**
   * @constructor
   * @param {object} params Parameters passed by the editor.
   * @param {number} contentId Content's id.
   * @param {object} [extras] Saved state, metadata, etc.
   */
  constructor(params, contentId, extras = {}) {
    super('isaac');

    // upload task to server
    if (UPLOAD_TASK_DATA) {
      const serverTaskContent = H5PIntegration.contents["cid-" + contentId];
      const isaacTask = new ISAACTask(H5PIntegration.baseUrl,
        contentId,
        serverTaskContent.metadata.title,
        serverTaskContent.library,
        params);
      uploadTask(isaacTask);
    }

    this.params = params;
    this.contentId = contentId;
    this.extras = extras;

    // make sure all variables are set (used by H5P's question type)
    this.params = extend({
      overallFeedback: [],
      scoreBarLabel: 'You got :num out of :total points',
      behaviour: {
        enableSolutionsButton: true,
        enableRetry: true
      },
      l10n: {
        checkAnswer: 'Check answer',
        showSolution: 'Show solution',
        tryAgain: 'Retry'
      }
    }, this.params);

    // this.previousState now holds the saved content state of the previous session
    this.previousState = this.extras.previousState || {};

    /**
     * Register the DOM elements with H5P.Question
     */
    this.registerDomElements = () => {

      // setImage and setVideo are H5P functions that seem to put media before all other content
      if (this.params.media) { //  && media.type && media.type.library
        const media = this.params.media;
        const type = media.library.split(' ')[0];
        if ((type === 'H5P.Image') && (media.params.file)) {
          this.setImage(media.params.file.path, {
            disableImageZooming: this.params.media.disableImageZooming || true,
            alt: media.params.alt,
            title: media.params.title
          });
        }
        else if ((type === 'H5P.Video') && (media.params.sources)) {
          this.setVideo(media);
        }
      }
      const content = new ISAACContent(
        this.params.task,
        this.params.passage,
        this.params.questions,
        this.contentId
        //this.previousState.random // previous session state
      );

      // Register content with H5P.Question
      this.setContent(content.getDOM());

      // Register Buttons
      this.addButtons();
    };

    /**
     * Add all the buttons that shall be passed to H5P.Question.
     */
    this.addButtons = () => {
      this.addButton('check-answer', this.params.l10n.checkAnswer, () => this.showEvaluation(), true, {}, {});
      this.addButton('show-solution', this.params.l10n.showSolution, () => this.showSolutions(), false, {}, {});
      this.addButton('try-again', this.params.l10n.tryAgain, () => this.showEvaluation(), false, {}, {});
    };

    /**
     * Display results
     */
    this.showEvaluation = function () {

      // require all blanks to be filled
      if (!this.getAnswerGiven()) return;

      const maxScore = this.getMaxScore();
      const score = this.getScore();
      const scoreText = H5P.Question.determineOverallFeedback(this.params.overallFeedback, score / maxScore)
          .replace('@score', score).replace('@total', maxScore);
      this.setFeedback(scoreText, score, maxScore, this.params.scoreBarLabel);
    };

    /**
     * Check if result has been submitted or input has been given.
     * @return {boolean} True, if answer was given.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-1}
     */
    this.getAnswerGiven = () => {

      let answered = true;
      for (let i = 0; i < this.params.questions.length; i++) {
        const input = document.getElementById(contentId + "_" + i);
        if (input.value.trim() === "") {

          // TODO: pop-up/text box - "must attempt all questions" (?)

          // highlight empty blanks
          if (input.className === 'h5p-isaac-input')
            input.classList.toggle("h5p-isaac-incorrect");

          // remove highlight when user has returned to blank
          input.addEventListener('focus', function() {
              input.setAttribute("class", "h5p-isaac-input");
          }, false);

          answered = false;
        }
      }
      return answered;
    };

    /**
     * Get latest score.
     * @return {number} latest score.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-2}
     */
    this.getScore = () => {

      this.hideButton('check-answer');
      let num_correct = 0;

      // iterate over all questions
      const questions = this.params.questions;
      for (let i = 0; i < questions.length; i++) {
        const input = document.getElementById(contentId + "_" + i);

        if (input.className === 'h5p-isaac-input h5p-isaac-correct') {
          num_correct++;
          continue;
        }

        // iterate over all target answer possibilities
        const targets = questions[i].targets;
        let correct = false;
        for (let j = 0; j < targets.length; j++) {
          if (input.value.trim() === targets[j]) {
            input.classList.toggle("h5p-isaac-correct");  // update style
            correct = true;
            num_correct++;
            break;
          }
        }

        // reject further changes if retry button disabled by content author
        if ((correct) || (!this.params.behaviour.enableRetry))
          H5P.jQuery(input).attr('disabled', true);

        // highlight incorrect answers
        if ((!correct) && (input.className !== "h5p-isaac-input h5p-isaac-incorrect")) {
          input.classList.toggle("h5p-isaac-incorrect");
          input.addEventListener('focus', function() {
            input.setAttribute("class", "h5p-isaac-input");
          }, false);

          // TODO: highlight start/end indices (is this even possible in input text box?)
        }
      }

      if (num_correct !== this.getMaxScore()) { // don't display buttons if score = 100%
        if (this.params.behaviour.enableSolutionsButton) this.showButton('show-solution');
        if (this.params.behaviour.enableRetry) this.showButton('try-again');
      } else {
        this.hideButton('show-solution');
        this.hideButton('try-again');
      }
      return num_correct;
    };

    /**
     * Get maximum possible score.
     * @return {number} Score necessary for mastering.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-3}
     */
    this.getMaxScore = () => this.params.questions.length;

    /**
     * Show solutions.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-4}
     */
    this.showSolutions = () => {

      for (let i = 0; i < this.params.questions.length; i++) {
        // certain characters are escaped (Character Entity References)
        let answer = document.createElement("textarea");
        answer.innerHTML = this.params.questions[i].targets[0];

        // get text box input
        let input = document.getElementById(contentId + "_" + i);
        input.value = answer.value;

        // reject further changes since answers have been revealed
        H5P.jQuery(input).attr('disabled', true);
      }

      // disable buttons since answers have been revealed
      this.hideButton('show-solution');
      this.hideButton('try-again');
      this.trigger('resize');
    };

    /**
     * Reset task.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-5}
     */
    this.resetTask = () => {

      // reset all incorrect input fields
      const questions = this.params.questions;
      for (let i = 0; i < questions.length; i++) {
        const answer = document.getElementById(contentId + "_" + i).value;

        // iterate over all target answer possibilities
        const targets = questions[i].targets;
        for (let j = 0; j < targets.length; j++) {

          let input = document.getElementById(contentId + "_" + i);

          if (answer.trim() !== targets[j]) {
            input.value = '';
          }

          input.setAttribute("class", "h5p-isaac-input");
        }
      }

      this.showButton('check-answer');
      this.hideButton('show-solution');
      this.hideButton('try-again');
      this.removeFeedback();  // remove score bar

      this.trigger('resize');
    };

    ///////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Get xAPI data.
     *
     * @return {object} XAPI statement.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
     */
    this.getXAPIData = () => ({
      statement: this.getXAPIAnswerEvent().data.statement
    });

    /**
     * Build xAPI answer event.
     *
     * @return {H5P.XAPIEvent} XAPI answer event.
     */
    this.getXAPIAnswerEvent = () => {
      const xAPIEvent = this.createXAPIEvent('answered');

      xAPIEvent.setScoredResult(this.getScore(), this.getMaxScore(), this,
        true, this.isPassed());

      /*
       * TODO: Add other properties here as required, e.g. xAPIEvent.data.statement.result.response
       * https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#245-result
       */

      return xAPIEvent;
    };

    /**
     * Create an xAPI event for Dictation.
     *
     * @param {string} verb Short id of the verb we want to trigger.
     * @return {H5P.XAPIEvent} Event template.
     */
    this.createXAPIEvent = (verb) => {
      const xAPIEvent = this.createXAPIEventTemplate(verb);
      extend(
        xAPIEvent.getVerifiedStatementValue(['object', 'definition']),
        this.getxAPIDefinition());
      return xAPIEvent;
    };

    /**
     * Get the xAPI definition for the xAPI object.
     *
     * @return {object} XAPI definition.
     */
    this.getxAPIDefinition = () => {
      const definition = {};
      definition.name = {'en-US': this.getTitle()};
      definition.description = {'en-US': this.getDescription()};

      // TODO: Set IRI as required for your verb, cmp. http://xapi.vocab.pub/verbs/#
      definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';

      // TODO: Set as required, cmp. https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#interaction-types
      definition.interactionType = 'other';

      /*
       * TODO: Add other object properties as required, e.g. definition.correctResponsesPattern
       * cmp. https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#244-object
       */

      return definition;
    };

    /**
     * Determine whether the task has been passed by the user.
     *
     * @return {boolean} True if user passed or task is not scored.
     */
    this.isPassed = () => true;

    /**
     * Get tasks title.
     *
     * @return {string} Title.
     */
    this.getTitle = () => {
      let raw;
      if (this.extras.metadata) {
        raw = this.extras.metadata.title;
      }
      raw = raw || ISAAC.DEFAULT_DESCRIPTION;

      // H5P Core function: createTitle
      return H5P.createTitle(raw);
    };

    /**
     * Get tasks description.
     *
     * @return {string} Description.
     */
    // TODO: Have a field for a task description in the editor if you need one.
    this.getDescription = () => this.params.taskDescription || ISAAC.DEFAULT_DESCRIPTION;

    /**
     * Extend an array just like JQuery's extend.
     *
     * @param {object} arguments Objects to be merged.
     * @return {object} Merged objects.
     */
    function extend() {
      for (let i = 1; i < arguments.length; i++) {
        for (let key in arguments[i]) {
          if (arguments[i].hasOwnProperty(key)) {
            if (typeof arguments[0][key] === 'object' && typeof arguments[i][key] === 'object') {
              extend(arguments[0][key], arguments[i][key]);
            }
            else {
              arguments[0][key] = arguments[i][key];
            }
          }
        }
      }
      return arguments[0];
    }

    /**
     * Answer call to return the current state.
     *
     * @return {object} Current state.
     */
    this.getCurrentState = () => {
      /*
       * TODO: Return any data object that will indicate the state that should
       * be loaded on start, here it's a random number
       */
      return {
        random: Math.random(100)
      };


    };
  }
}

/** @constant {string} */
ISAAC.DEFAULT_DESCRIPTION = 'Hello World';
