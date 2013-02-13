/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Responsible for filling in form information.
 *  - When an element is focused, the browser view zooms in to the control.
 *  - The caret positionning and the view are sync to keep the type
 *    in text into view for input fields (text/textarea).
 *  - Provides autocomplete box for input fields.
 */

const kBrowserFormZoomLevelMin = 0.8;
const kBrowserFormZoomLevelMax = 2.0;

// Prefs
const kPrefFormHelperEnabled = "formhelper.enabled";
const kPrefFormHelperMode = "formhelper.mode";
const kPrefFormHelperZoom = "formhelper.autozoom";
const kPrefFormHelperZoomCaret = "formhelper.autozoom.caret";

var FormHelperUI = {
  _debugEvents: false,
  _currentBrowser: null,
  _currentElement: null,
  _currentCaretRect: null,
  _currentElementRect: null,

  type: "form",

  get enabled() {
    return Services.prefs.getBoolPref(kPrefFormHelperEnabled);
  },

  init: function formHelperInit() {
    // Listen for form assistant messages from content
    messageManager.addMessageListener("FormAssist:Show", this);
    messageManager.addMessageListener("FormAssist:Hide", this);
    messageManager.addMessageListener("FormAssist:Update", this);
    messageManager.addMessageListener("FormAssist:Resize", this);
    messageManager.addMessageListener("FormAssist:AutoComplete", this);
    messageManager.addMessageListener("FormAssist:ValidationMessage", this);

    // Listen for events where form assistant should be closed or updated
    let tabs = Elements.tabList;
    tabs.addEventListener("TabSelect", this, true);
    tabs.addEventListener("TabClose", this, true);
    Elements.browsers.addEventListener("URLChanged", this, true);
    Elements.browsers.addEventListener("SizeChanged", this, true);

    // Listen some events to show/hide arrows
    Elements.browsers.addEventListener("PanBegin", this, false);
    Elements.browsers.addEventListener("PanFinished", this, false);

    // Dynamically enabled/disabled the form helper if needed depending on
    // the size of the screen
    let mode = Services.prefs.getIntPref(kPrefFormHelperMode);
    let state = (mode == 2) ? false : !!mode;
    Services.prefs.setBoolPref(kPrefFormHelperEnabled, state);
  },

  /*
   * Open of the form helper proper. Currently doesn't display anything
   * on metro since the nav buttons are off.
   */
  show: function formHelperShow(aElement, aHasPrevious, aHasNext) {
    // Delay the operation until all resize operations generated by the
    // keyboard apparition are done. This avoid doing unuseful zooming
    // operations.
    if (aElement.editable &&
        (MetroUtils.immersive && !ContentAreaObserver.isKeyboardOpened &&
         !InputSourceHelper.isPrecise)) {
      this._waitForKeyboard(aElement, aHasPrevious, aHasNext);
      return;
    }

    this._currentBrowser = Browser.selectedBrowser;
    this._currentCaretRect = null;

    let lastElement = this._currentElement || null;

    this._currentElement = {
      id: aElement.id,
      name: aElement.name,
      title: aElement.title,
      value: aElement.value,
      maxLength: aElement.maxLength,
      type: aElement.type,
      choices: aElement.choices,
      isAutocomplete: aElement.isAutocomplete,
      validationMessage: aElement.validationMessage,
      list: aElement.list,
      rect: aElement.rect
    };

    this._zoom(Rect.fromRect(aElement.rect), Rect.fromRect(aElement.caretRect));
    this._updateContainerForSelect(lastElement, this._currentElement);
    this._updatePopupsFor(this._currentElement);

    // Prevent the view to scroll automatically while typing
    this._currentBrowser.scrollSync = false;
  },

  hide: function formHelperHide() {
    SelectHelperUI.hide();
    AutofillMenuUI.hide();

    // Restore the scroll synchonisation
    if (this._currentBrowser)
      this._currentBrowser.scrollSync = true;

    // reset current Element and Caret Rect
    this._currentElementRect = null;
    this._currentCaretRect = null;

    this._updateContainerForSelect(this._currentElement, null);
    if (this._currentBrowser)
      this._currentBrowser.messageManager.sendAsyncMessage("FormAssist:Closed", { });
  },

  /*
   * Events
   */

  handleEvent: function formHelperHandleEvent(aEvent) {
    if (this._debugEvents) Util.dumpLn(aEvent.type);

    if (!this._open)
      return;

    switch (aEvent.type) {
      case "TabSelect":
      case "TabClose":
      case "PanBegin":
      case "SizeChanged":
        this.hide();
        break;

      case "URLChanged":
        if (aEvent.detail && aEvent.target == getBrowser())
          this.hide();
        break;
    }
  },

  receiveMessage: function formHelperReceiveMessage(aMessage) {
    if (this._debugEvents) Util.dumpLn(aMessage.name);
    let allowedMessages = ["FormAssist:Show", "FormAssist:Hide",
                           "FormAssist:AutoComplete", "FormAssist:ValidationMessage"];
    if (!this._open && allowedMessages.indexOf(aMessage.name) == -1)
      return;

    let json = aMessage.json;
    switch (aMessage.name) {
      case "FormAssist:Show":
        // if the user has manually disabled the Form Assistant UI we still
        // want to show a UI for <select /> element and still want to show
        // autocomplete suggestions but not managed by FormHelperUI
        if (this.enabled) {
          this.show(json.current, json.hasPrevious, json.hasNext)
        } else if (json.current.choices) {
          SelectHelperUI.show(json.current.choices, json.current.title, json.current.rect);
        } else {
          this._currentElementRect = Rect.fromRect(json.current.rect);
          this._currentBrowser = getBrowser();
          this._updatePopupsFor(json.current);
        }
        break;

      case "FormAssist:Hide":
        if (this.enabled) {
          this.hide();
        }
        break;

      case "FormAssist:Resize":
        if (!ContentAreaObserver.isKeyboardOpened)
          return;

        let element = json.current;
        this._zoom(Rect.fromRect(element.rect), Rect.fromRect(element.caretRect));
        break;

      case "FormAssist:ValidationMessage":
        this._updatePopupsFor(json.current, { fromInput: true });
        break;

      case "FormAssist:AutoComplete":
        this._updatePopupsFor(json.current, { fromInput: true });
        break;

       case "FormAssist:Update":
        if (!ContentAreaObserver.isKeyboardOpened)
          return;
        //this._zoom(null, Rect.fromRect(json.caretRect));
        break;
    }
  },

  doAutoComplete: function formHelperDoAutoComplete(aData) {
    this._currentBrowser.messageManager.sendAsyncMessage("FormAssist:AutoComplete",
      { value: aData });
  },

  get _open() {
    // XXX we don't have the ability to test zooming
    return true;
  },

  /*
   * Update all popups based on the type of form element we are
   * dealing with.
   */
  _updatePopupsFor: function _formHelperUpdatePopupsFor(aElement, options) {
    options = options || {};

    let fromInput = 'fromInput' in options && options.fromInput;

    // The order of the updates matters here. If the popup update was
    // triggered from user input (e.g. key press in an input element),
    // we first check if there are input suggestions then check for
    // a validation message. The idea here is that the validation message
    // will be shown straight away once the invalid element is focused
    // and suggestions will be shown as user inputs data. Only one popup
    // is shown at a time. If both are not shown, then we ensure any
    // previous popups are hidden.
    let noPopupsShown = fromInput ?
                        (!this._updateSuggestionsFor(aElement) &&
                         !this._updateFormValidationFor(aElement)) :
                        (!this._updateFormValidationFor(aElement) &&
                         !this._updateSuggestionsFor(aElement));

    if (noPopupsShown) {
      AutofillMenuUI.hide();
    }
  },

  /*
   * Populates the autofill menu for this element.
   */
  _updateSuggestionsFor: function _formHelperUpdateSuggestionsFor(aElement) {
    let suggestions = this._getAutocompleteSuggestions(aElement);
    if (!suggestions.length)
      return false;

    // the scrollX/scrollY position can change because of the animated zoom so
    // delay the suggestions positioning
    /*
    if (AnimatedZoom.isZooming()) {
      let self = this;
      this._waitForZoom(function() {
        self._updateSuggestionsFor(aElement);
      });
      return true;
    }
    */
    
    AutofillMenuUI.show(this._currentElementRect, suggestions);
    return true;
  },

  _updateFormValidationFor: function _formHelperUpdateFormValidationFor(aElement) {
    if (!aElement.validationMessage)
      return false;
    /*
    // the scrollX/scrollY position can change because of the animated zoom so
    // delay the suggestions positioning
    if (AnimatedZoom.isZooming()) {
      let self = this;
      this._waitForZoom(function() {
        self._updateFormValidationFor(aElement);
      });
      return true;
    }

    let validationContainer = document.getElementById("form-helper-validation-container");

    // Update label with form validation message
    validationContainer.firstChild.value = aElement.validationMessage;

    ContentPopupHelper.popup = validationContainer;
    ContentPopupHelper.anchorTo(this._currentElementRect);
    */

    return false;
  },

  /*
   * Retrieve the autocomplete list from the autocomplete service for an element
   */
  _getAutocompleteSuggestions: function _formHelperGetAutocompleteSuggestions(aElement) {
    if (!aElement.isAutocomplete) {
      return [];
    }

    let suggestions = [];

    let autocompleteService = Cc["@mozilla.org/satchel/form-autocomplete;1"].getService(Ci.nsIFormAutoComplete);
    let results = autocompleteService.autoCompleteSearch(aElement.name || aElement.id, aElement.value, aElement, null);
    if (results.matchCount > 0) {
      for (let i = 0; i < results.matchCount; i++) {
        let value = results.getValueAt(i);

        // Do not show the value if it is the current one in the input field
        if (value == aElement.value)
          continue;

        suggestions.push({ "label": value, "value": value});
      }
    }

    // Add the datalist elements provided by the website, note that the
    // displayed value can differ from the real value of the element.
    let options = aElement.list;
    for (let i = 0; i < options.length; i++)
      suggestions.push(options[i]);

    return suggestions;
  },

  /*
   * Setup for displaying the selection choices menu
   */
  _updateContainerForSelect: function _formHelperUpdateContainerForSelect(aLastElement, aCurrentElement) {
    let lastHasChoices = aLastElement && (aLastElement.choices != null);
    let currentHasChoices = aCurrentElement && (aCurrentElement.choices != null);

    if (currentHasChoices)
      SelectHelperUI.show(aCurrentElement.choices, aCurrentElement.title, aCurrentElement.rect);
    else if (lastHasChoices)
      SelectHelperUI.hide();
  },

  /*
   * Zoom and move viewport so that element is legible and touchable.
   */
  _zoom: function _formHelperZoom(aElementRect, aCaretRect) {
    let browser = getBrowser();
    let zoomRect = Rect.fromRect(browser.getBoundingClientRect());

    this._currentElementRect = aElementRect;

    // Zoom to a specified Rect
    let autozoomEnabled = Services.prefs.getBoolPref(kPrefFormHelperZoom);
    if (aElementRect && Browser.selectedTab.allowZoom && autozoomEnabled) {
      this._currentElementRect = aElementRect;

      // Zoom to an element by keeping the caret into view
      let zoomLevel = Browser.selectedTab.clampZoomLevel(this._getZoomLevelForRect(aElementRect));

      zoomRect = Browser._getZoomRectForPoint(aElementRect.center().x, aElementRect.y, zoomLevel);
      AnimatedZoom.animateTo(zoomRect);
    } else if (aElementRect && !Browser.selectedTab.allowZoom && autozoomEnabled) {
      this._currentElementRect = aElementRect;

      // Even if zooming is disabled we could need to reposition the view in
      // order to keep the element on-screen
      zoomRect = Browser._getZoomRectForPoint(aElementRect.center().x, aElementRect.y, browser.scale);
      AnimatedZoom.animateTo(zoomRect);
    }

    this._ensureCaretVisible(aCaretRect);
  },

  _ensureCaretVisible: function _ensureCaretVisible(aCaretRect) {
    if (!aCaretRect || !Services.prefs.getBoolPref(kPrefFormHelperZoomCaret))
      return;

    // the scrollX/scrollY position can change because of the animated zoom so
    // delay the caret adjustment
    if (AnimatedZoom.isZooming()) {
      let self = this;
      this._waitForZoom(function() {
        self._ensureCaretVisible(aCaretRect);
      });
      return;
    }

    let browser = getBrowser();
    let zoomRect = Rect.fromRect(browser.getBoundingClientRect());

    this._currentCaretRect = aCaretRect;
    let caretRect = aCaretRect.clone().scale(browser.scale, browser.scale);

    let scroll = browser.getRootView().getPosition();
    zoomRect = new Rect(scroll.x, scroll.y, zoomRect.width, zoomRect.height);
    if (zoomRect.contains(caretRect))
      return;

    let [deltaX, deltaY] = this._getOffsetForCaret(caretRect, zoomRect);
    if (deltaX != 0 || deltaY != 0) {
      let view = browser.getRootView();
      view.scrollBy(deltaX, deltaY);
    }
  },

  _waitForZoom: function _formHelperWaitForZoom(aCallback) {
    let currentElement = this._currentElement;
    let self = this;
    window.addEventListener("AnimatedZoomEnd", function() {
      window.removeEventListener("AnimatedZoomEnd", arguments.callee, true);
      // Ensure the current element has not changed during this interval
      if (self._currentElement != currentElement)
        return;

      aCallback();
    }, true);
  },

  _getZoomLevelForRect: function _getZoomLevelForRect(aRect) {
    const margin = 30;
    let zoomLevel = getBrowser().getBoundingClientRect().width / (aRect.width + margin);

    // Clamp the zoom level relatively to the default zoom level of the page
    let defaultZoomLevel = Browser.selectedTab.getDefaultZoomLevel();
    return Util.clamp(zoomLevel, (defaultZoomLevel * kBrowserFormZoomLevelMin),
                                 (defaultZoomLevel * kBrowserFormZoomLevelMax));
  },

  _getOffsetForCaret: function _formHelperGetOffsetForCaret(aCaretRect, aRect) {
    // Determine if we need to move left or right to bring the caret into view
    let deltaX = 0;
    if (aCaretRect.right > aRect.right)
      deltaX = aCaretRect.right - aRect.right;
    if (aCaretRect.left < aRect.left)
      deltaX = aCaretRect.left - aRect.left;

    // Determine if we need to move up or down to bring the caret into view
    let deltaY = 0;
    if (aCaretRect.bottom > aRect.bottom)
      deltaY = aCaretRect.bottom - aRect.bottom;
    if (aCaretRect.top < aRect.top)
      deltaY = aCaretRect.top - aRect.top;

    return [deltaX, deltaY];
  },

  _waitForKeyboard: function formHelperWaitForKeyboard(aElement, aHasPrevious, aHasNext) {
    let self = this;
    window.addEventListener("KeyboardChanged", function(aEvent) {
      window.removeEventListener("KeyboardChanged", arguments.callee, false);

      if (AnimatedZoom.isZooming()) {
        self._waitForZoom(function() {
          self.show(aElement, aHasPrevious, aHasNext);
        });
        return;
      }

      self.show(aElement, aHasPrevious, aHasNext);
    }, false);
  }
};

