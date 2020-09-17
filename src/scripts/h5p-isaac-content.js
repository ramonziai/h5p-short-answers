import { ISAACFieldListener } from './h5p-isaac-interaction';

export default class ISAACContent {
  /**
   * @constructor
   * @param task {string} Brief description of how to complete the task
   * @param passage {string} Text upon which questions are based (max 10,000 chars)
   * @param questions {array} List of pairs of question and target answer(s)
   * @param contentID {number} Integer representing the content ID
   * @param backend {string} Address of backend server
   * @param prev {object} Contains array of user input values
   */
  constructor(task, passage, questions, contentID, backend, prev) {

    this.content = document.createElement('div');
    this.content.classList.add('h5p-isaac');

    // if task or passage are not modified/clicked on during setup, they won't be <p> elements
    if (!task.startsWith('<p>')) { task = `<p>${task}</p>`; }
    if (!passage.startsWith('<p>')) { passage = `<p>${passage}</p>`; }

    // task instructions
    const taskNode = document.createElement('p');
    taskNode.innerHTML = task.trim();
    taskNode.firstElementChild.classList.add('h5p-isaac-task');
    this.content.appendChild(taskNode.firstElementChild);

    // passage text
    if (passage.trim() !== '') {
      const passageNode = document.createElement('p');
      passageNode.innerHTML = passage.trim();
      passageNode.classList.add('h5p-isaac-passage');
      passageNode.setAttribute('id', `${contentID}_passage`);
      const tag = `<span id='${contentID}_$1_mark' class='h5p-isaac-highlight h5p-isaac-highlight-hidden'>$2</span>`;
      passageNode.innerHTML = `${passageNode.innerHTML.replace(/(\d+)\*\*(.*?)\*\*/gi, tag)}`;
      this.content.appendChild(passageNode);
    }

    // begin Q&A section
    const ol = document.createElement('ol');
    ol.setAttribute('id', `${contentID}_questions`);
    ol.classList.add('h5p-isaac-questions');

    for (let i = 0; i < questions.length; i++) {
      // question text
      let question = questions[i].question;
      if (!question.startsWith('<p>')) { question = `<p>${question}</p>`; }
      const questionWrapper = document.createElement('li');
      questionWrapper.classList.add('h5p-isaac-question-wrapper');
      questionWrapper.innerHTML = question.trim();
      questionWrapper.firstElementChild.setAttribute('id', `${contentID}_${i + 1}_prompt`);
      questionWrapper.firstElementChild.classList.add('h5p-isaac-question');

      // create wrapper for input field and icons
      const inputWrapper = document.createElement('div');
      inputWrapper.setAttribute('id', `${contentID}_${i}`);
      inputWrapper.classList.add('h5p-isaac-input-wrapper');

      // create input text box
      const userInput = document.createElement('div');
      userInput.setAttribute('id', `${contentID}_${i}_input`);
      userInput.setAttribute('autocomplete', 'disabled'); // 'off' for browsers other than Chrome?
      userInput.setAttribute('autocorrect', 'off');
      userInput.setAttribute('spellcheck', 'false');
      userInput.setAttribute('contenteditable', 'true'); // requires workaround to disable rich text
      // userInput.setAttribute('contenteditable', 'plaintext-only'); // ideal but not widely supported (sept 2020)
      userInput.classList.add('h5p-isaac-input');
      userInput.onfocus = () => userInput.parentElement.classList.add('h5p-isaac-input-wrapper-focus');
      userInput.onblur = () => userInput.parentElement.classList.remove('h5p-isaac-input-wrapper-focus');

      // set input with previously saved content state, if applicable
      userInput.textContent = prev.responses ? prev.responses[i] : '';

      // register input handler
      userInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const listener = new ISAACFieldListener(contentID, i, questions[i].targets, backend, 'intermediate');
          listener.handleEvent(document.getElementById(`${contentID}_${i}_input`).textContent);
          userInput.blur(); // remove focus from text input; currently cursor is undesirably being set to index 0
        }
      });
      userInput.addEventListener('paste', function (e) {
        // remove rich text formatting when pasting formatted text;
        // replace this listener with contenteditable='plaintext-only' when it is more widely supported
        // https://caniuse.com/?search=contenteditable%3D%22plaintext-only%22
        e.preventDefault();
        const index = window.getSelection().getRangeAt(0).startOffset;
        const start = userInput.textContent.substr(0, index);
        const end = userInput.textContent.substr(index, userInput.textContent.length);
        const clipboardText = e.clipboardData.getData('text/plain');
        userInput.textContent = `${start}${clipboardText}${end}`;
        // reposition cursor after pasting (default behavior positions cursor at index 0)
        const setpos = document.createRange();
        const set = window.getSelection();
        setpos.setStart(userInput.childNodes[0], index + clipboardText.length);
        setpos.collapse(true);
        set.removeAllRanges();
        set.addRange(setpos);
        userInput.focus();
        // TODO does not overwrite selected text;
      });

      // create input button
      const enterButton = document.createElement('button');
      enterButton.classList.add('h5p-isaac-button', 'h5p-isaac-input-button', 'h5p-isaac-enter', 'tooltip');
      enterButton.setAttribute('id', `${contentID}_${i}_submit`);
      const buttonTooltipText = document.createElement('span');
      buttonTooltipText.classList.add('tooltiptext');
      buttonTooltipText.innerText = 'Get Feedback'; // TODO: get localized text from semantics
      // enterButton.appendChild(buttonTooltipText);

      // register input handler
      enterButton.addEventListener('click', function (e) {
        const listener = new ISAACFieldListener(contentID, i, questions[i].targets, backend, 'intermediate');
        listener.handleEvent(document.getElementById(`${contentID}_${i}_input`).textContent);
        enterButton.blur();
      });

      // feedback toggle button
      const feedbackButton = document.createElement('button');
      feedbackButton.setAttribute('id', `${contentID}_${i}_feedback_button`);
      feedbackButton.classList.add('h5p-isaac-button', 'h5p-isaac-feedback-button', 'h5p-isaac-hidden', 'tooltip');
      const feedbackTooltipText = document.createElement('span');
      feedbackTooltipText.classList.add('tooltiptext');
      feedbackTooltipText.innerText = 'Show Feedback'; // TODO: get localized text from semantics
      // feedbackButton.appendChild(feedbackTooltipText);

      // passage highlight toggle button
      const infoButton = document.createElement('button');
      infoButton.setAttribute('id', `${contentID}_${i}_info`);
      infoButton.classList.add('h5p-isaac-button', 'h5p-isaac-info', 'h5p-isaac-hidden', 'tooltip');
      const infoTooltipText = document.createElement('span');
      infoTooltipText.classList.add('tooltiptext');
      infoTooltipText.innerText = 'Show context'; // TODO: get localized text from semantics
      // infoButton.appendChild(infoTooltipText);

      // pop-up container
      const popup = document.createElement('div');
      popup.setAttribute('id', `${contentID}_${i}_popup`);
      popup.classList.add('h5p-isaac-popup', 'h5p-isaac-popup-collapsed');
      const popupText = document.createElement('div');
      popupText.classList.add('h5p-isaac-popup-text', 'h5p-isaac-hidden');
      popup.appendChild(popupText);

      // popup yes/no buttons
      const yes = document.createElement('button');
      yes.setAttribute('id', `${contentID}_${i}_yes`);
      yes.classList.add('h5p-isaac-popup-button', 'h5p-isaac-popup-button-yes', 'h5p-isaac-hidden');
      const no = document.createElement('button');
      no.setAttribute('id', `${contentID}_${i}_no`);
      no.classList.add('h5p-isaac-popup-button', 'h5p-isaac-popup-button-no', 'h5p-isaac-hidden');
      popup.appendChild(yes);
      popup.appendChild(no);

      inputWrapper.appendChild(userInput);
      inputWrapper.appendChild(enterButton);
      questionWrapper.appendChild(inputWrapper);
      questionWrapper.appendChild(feedbackButton);
      questionWrapper.appendChild(infoButton);
      questionWrapper.appendChild(popup);
      ol.appendChild(questionWrapper);
    }

    // add Q&A section to DOM
    this.content.appendChild(ol);

    /**
     * Return the DOM for this class.
     * @return {HTMLElement} DOM for this class.
     */
    this.getDOM = () => {
      return this.content;
    };
  }
}
