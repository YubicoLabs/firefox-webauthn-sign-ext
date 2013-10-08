/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["CustomizeMode"];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

const kPrefCustomizationDebug = "browser.uiCustomization.debug";
const kPrefCustomizationAnimation = "browser.uiCustomization.disableAnimation";
const kPaletteId = "customization-palette";
const kAboutURI = "about:customizing";
const kDragDataTypePrefix = "text/toolbarwrapper-id/";
const kPlaceholderClass = "panel-customization-placeholder";
// TODO(bug 885574): Merge this constant with the one in CustomizableWidgets.jsm,
//                   maybe just use a pref for this.
const kColumnsInMenuPanel = 3;
const kSkipSourceNodePref = "browser.uiCustomization.skipSourceNodeCheck";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/CustomizableUI.jsm");
Cu.import("resource://gre/modules/LightweightThemeManager.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/Promise.jsm");

let gModuleName = "[CustomizeMode]";
#include logging.js

let gDisableAnimation = null;

function CustomizeMode(aWindow) {
  if (gDisableAnimation === null) {
    gDisableAnimation = Services.prefs.getPrefType(kPrefCustomizationAnimation) == Ci.nsIPrefBranch.PREF_BOOL &&
                        Services.prefs.getBoolPref(kPrefCustomizationAnimation);
  }
  this.window = aWindow;
  this.document = aWindow.document;
  this.browser = aWindow.gBrowser;

  // There are two palettes - there's the palette that can be overlayed with
  // toolbar items in browser.xul. This is invisible, and never seen by the
  // user. Then there's the visible palette, which gets populated and displayed
  // to the user when in customizing mode.
  this.visiblePalette = this.document.getElementById(kPaletteId);
};

CustomizeMode.prototype = {
  _changed: false,
  _transitioning: false,
  window: null,
  document: null,
  // areas is used to cache the customizable areas when in customization mode.
  areas: null,
  // When in customizing mode, we swap out the reference to the invisible
  // palette in gNavToolbox.palette for our visiblePalette. This way, for the
  // customizing browser window, when widgets are removed from customizable
  // areas and added to the palette, they're added to the visible palette.
  // _stowedPalette is a reference to the old invisible palette so we can
  // restore gNavToolbox.palette to its original state after exiting
  // customization mode.
  _stowedPalette: null,
  _dragOverItem: null,
  _customizing: false,
  _skipSourceNodeCheck: null,

  get panelUIContents() {
    return this.document.getElementById("PanelUI-contents");
  },

  toggle: function() {
    if (this._transitioning) {
      return;
    }
    if (this._customizing) {
      this.exit();
    } else {
      this.enter();
    }
  },

  enter: function() {
    if (this._customizing || this._transitioning) {
      return;
    }

    // We don't need to switch to kAboutURI, or open a new tab at
    // kAboutURI if we're already on it.
    if (this.browser.selectedBrowser.currentURI.spec != kAboutURI) {
      this.window.switchToTabHavingURI(kAboutURI, true);
      return;
    }

    // Disable lightweight themes while in customization mode since
    // they don't have large enough images to pad the full browser window.
    LightweightThemeManager.temporarilyToggleTheme(false);

    this.dispatchToolboxEvent("beforecustomization");

    let window = this.window;
    let document = this.document;

    CustomizableUI.addListener(this);

    // Add a keypress listener and mousedown listener to the tab-view-deck so that
    // we can quickly exit customization mode when pressing ESC or clicking on
    // the blueprint outside the customization container.
    let deck = document.getElementById("tab-view-deck");
    deck.addEventListener("keypress", this);
    deck.addEventListener("mousedown", this);

    // Same goes for the menu button - if we're customizing, a mousedown to the
    // menu button means a quick exit from customization mode.
    window.PanelUI.hide();
    window.PanelUI.menuButton.addEventListener("mousedown", this);
    window.PanelUI.menuButton.open = true;
    window.PanelUI.beginBatchUpdate();

    // Move the mainView in the panel to the holder so that we can see it
    // while customizing.
    let panelHolder = document.getElementById("customization-panelHolder");
    panelHolder.appendChild(window.PanelUI.mainView);

    this._transitioning = true;

    let customizer = document.getElementById("customization-container");
    customizer.parentNode.selectedPanel = customizer;
    customizer.hidden = false;

    Task.spawn(function() {
      yield this._doTransition(true);

      // Let everybody in this window know that we're about to customize.
      this.dispatchToolboxEvent("customizationstarting");

      // The menu panel is lazy, and registers itself when the popup shows. We
      // need to force the menu panel to register itself, or else customization
      // is really not going to work. We pass "true" to ensureRegistered to
      // indicate that we're handling calling startBatchUpdate and
      // endBatchUpdate.
      yield window.PanelUI.ensureReady(true);

      this._showPanelCustomizationPlaceholders();

      yield this._wrapToolbarItems();
      yield this.populatePalette();

      window.PanelUI.mainView.addEventListener("contextmenu", this, true);
      this.visiblePalette.addEventListener("dragstart", this, true);
      this.visiblePalette.addEventListener("dragover", this, true);
      this.visiblePalette.addEventListener("dragexit", this, true);
      this.visiblePalette.addEventListener("drop", this, true);
      this.visiblePalette.addEventListener("dragend", this, true);

      window.gNavToolbox.addEventListener("toolbarvisibilitychange", this);

      document.getElementById("PanelUI-help").setAttribute("disabled", true);
      document.getElementById("PanelUI-quit").setAttribute("disabled", true);

      this._updateResetButton();

      this._skipSourceNodeCheck = Services.prefs.getPrefType(kSkipSourceNodePref) == Ci.nsIPrefBranch.PREF_BOOL &&
                                  Services.prefs.getBoolPref(kSkipSourceNodePref);

      let customizableToolbars = document.querySelectorAll("toolbar[customizable=true]:not([autohide=true]):not([collapsed=true])");
      for (let toolbar of customizableToolbars)
        toolbar.setAttribute("customizing", true);

      window.PanelUI.endBatchUpdate();
      this._customizing = true;
      this._transitioning = false;
      this.dispatchToolboxEvent("customizationready");
    }.bind(this)).then(null, ERROR);
  },

  exit: function() {
    if (!this._customizing || this._transitioning) {
      return;
    }

    CustomizableUI.removeListener(this);

    let deck = this.document.getElementById("tab-view-deck");
    deck.removeEventListener("keypress", this);
    deck.removeEventListener("mousedown", this);
    this.window.PanelUI.menuButton.removeEventListener("mousedown", this);
    this.window.PanelUI.menuButton.open = false;

    this.window.PanelUI.beginBatchUpdate();

    this._removePanelCustomizationPlaceholders();

    this._transitioning = true;

    let window = this.window;
    let document = this.document;
    let documentElement = document.documentElement;

    Task.spawn(function() {
      yield this.depopulatePalette();

      yield this._doTransition(false);

      let customizer = document.getElementById("customization-container");
      customizer.hidden = true;
      let browser = document.getElementById("browser");
      browser.parentNode.selectedPanel = browser;

      window.gNavToolbox.removeEventListener("toolbarvisibilitychange", this);

      window.PanelUI.mainView.removeEventListener("contextmenu", this, true);
      this.visiblePalette.removeEventListener("dragstart", this, true);
      this.visiblePalette.removeEventListener("dragover", this, true);
      this.visiblePalette.removeEventListener("dragexit", this, true);
      this.visiblePalette.removeEventListener("drop", this, true);
      this.visiblePalette.removeEventListener("dragend", this, true);

      yield this._unwrapToolbarItems();

      if (this._changed) {
        // XXXmconley: At first, it seems strange to also persist the old way with
        //             currentset - but this might actually be useful for switching
        //             to old builds. We might want to keep this around for a little
        //             bit.
        this.persistCurrentSets();
      }

      // And drop all area references.
      this.areas = [];

      // Let everybody in this window know that we're starting to
      // exit customization mode.
      this.dispatchToolboxEvent("customizationending");

      window.PanelUI.setMainView(window.PanelUI.mainView);
      window.PanelUI.menuButton.disabled = false;

      // We have to use setAttribute/removeAttribute here instead of the
      // property because the XBL property will be set later, and right
      // now we'd be setting an expando, which breaks the XBL property.
      document.getElementById("PanelUI-help").removeAttribute("disabled");
      document.getElementById("PanelUI-quit").removeAttribute("disabled");

      // We need to set this._customizing to false before removing the tab
      // or the TabSelect event handler will think that we are exiting
      // customization mode for a second time.
      this._customizing = false;

      if (this.browser.selectedBrowser.currentURI.spec == kAboutURI) {
        let custBrowser = this.browser.selectedBrowser;
        if (custBrowser.canGoBack) {
          // If there's history to this tab, just go back.
          custBrowser.goBack();
        } else {
          // If we can't go back, we're removing the about:customization tab.
          // We only do this if we're the top window for this window (so not
          // a dialog window, for example).
          if (window.getTopWin(true) == window) {
            let customizationTab = this.browser.selectedTab;
            if (this.browser.browsers.length == 1) {
              window.BrowserOpenTab();
            }
            this.browser.removeTab(customizationTab);
          }
        }
      }

      LightweightThemeManager.temporarilyToggleTheme(true);

      let customizableToolbars = document.querySelectorAll("toolbar[customizable=true]:not([autohide=true])");
      for (let toolbar of customizableToolbars)
        toolbar.removeAttribute("customizing");

      this.window.PanelUI.endBatchUpdate();
      this._changed = false;
      this._transitioning = false;
      this.dispatchToolboxEvent("aftercustomization");
    }.bind(this)).then(null, ERROR);
  },

  _doTransition: function(aEntering) {
    let deferred = Promise.defer();

    let deck = this.document.getElementById("tab-view-deck");
    let customizeTransitionEnd = function(aEvent) {
      if (aEvent.originalTarget != deck || aEvent.propertyName != "padding-top") {
        return;
      }
      deck.removeEventListener("transitionend", customizeTransitionEnd);

      if (!aEntering) {
        this.document.documentElement.removeAttribute("customize-exiting");
      }
      this.dispatchToolboxEvent("customization-transitionend", aEntering);

      deferred.resolve();
    }.bind(this);
    deck.addEventListener("transitionend", customizeTransitionEnd);

    if (gDisableAnimation) {
      deck.setAttribute("fastcustomizeanimation", true);
    }
    if (aEntering) {
      this.document.documentElement.setAttribute("customizing", true);
    } else {
      this.document.documentElement.setAttribute("customize-exiting", true);
      this.document.documentElement.removeAttribute("customizing");
    }
    return deferred.promise;
  },

  dispatchToolboxEvent: function(aEventType, aDetails={}) {
    let evt = this.document.createEvent("CustomEvent");
    evt.initCustomEvent(aEventType, true, true, {changed: this._changed});
    let result = this.window.gNavToolbox.dispatchEvent(evt);
  },

  addToToolbar: function(aNode) {
    CustomizableUI.addWidgetToArea(aNode.id, CustomizableUI.AREA_NAVBAR);
  },

  removeFromPanel: function(aNode) {
    CustomizableUI.removeWidgetFromArea(aNode.id);
  },

  populatePalette: function() {
    let fragment = this.document.createDocumentFragment();
    let toolboxPalette = this.window.gNavToolbox.palette;

    return Task.spawn(function() {
      let unusedWidgets = CustomizableUI.getUnusedWidgets(toolboxPalette);
      for (let widget of unusedWidgets) {
        let paletteItem = this.makePaletteItem(widget, "palette");
        fragment.appendChild(paletteItem);
      }

      this.visiblePalette.appendChild(fragment);
      this._stowedPalette = this.window.gNavToolbox.palette;
      this.window.gNavToolbox.palette = this.visiblePalette;
    }.bind(this)).then(null, ERROR);
  },

  //XXXunf Maybe this should use -moz-element instead of wrapping the node?
  //       Would ensure no weird interactions/event handling from original node,
  //       and makes it possible to put this in a lazy-loaded iframe/real tab
  //       while still getting rid of the need for overlays.
  makePaletteItem: function(aWidget, aPlace) {
    let widgetNode = aWidget.forWindow(this.window).node;
    let wrapper = this.createWrapper(widgetNode, aPlace);
    wrapper.appendChild(widgetNode);
    return wrapper;
  },

  depopulatePalette: function() {
    return Task.spawn(function() {
      this.visiblePalette.hidden = true;
      let paletteChild = this.visiblePalette.firstChild;
      let nextChild;
      while (paletteChild) {
        nextChild = paletteChild.nextElementSibling;
        let provider = CustomizableUI.getWidget(paletteChild.id).provider;
        if (provider == CustomizableUI.PROVIDER_XUL) {
          let unwrappedPaletteItem =
            yield this.deferredUnwrapToolbarItem(paletteChild);
          this._stowedPalette.appendChild(unwrappedPaletteItem);
        } else if (provider == CustomizableUI.PROVIDER_API) {
          //XXXunf Currently this doesn't destroy the (now unused) node. It would
          //       be good to do so, but we need to keep strong refs to it in
          //       CustomizableUI (can't iterate of WeakMaps), and there's the
          //       question of what behavior wrappers should have if consumers
          //       keep hold of them.
          //widget.destroyInstance(widgetNode);
        } else if (provider == CustomizableUI.PROVIDER_SPECIAL) {
          this.visiblePalette.removeChild(paletteChild);
        }

        paletteChild = nextChild;
      }
      this.visiblePalette.hidden = false;
      this.window.gNavToolbox.palette = this._stowedPalette;
    }.bind(this)).then(null, ERROR);
  },

  isCustomizableItem: function(aNode) {
    return aNode.localName == "toolbarbutton" ||
           aNode.localName == "toolbaritem" ||
           aNode.localName == "toolbarseparator" ||
           aNode.localName == "toolbarspring" ||
           aNode.localName == "toolbarspacer";
  },

  isWrappedToolbarItem: function(aNode) {
    return aNode.localName == "toolbarpaletteitem";
  },

  deferredWrapToolbarItem: function(aNode, aPlace) {
    let deferred = Promise.defer();

    dispatchFunction(function() {
      let wrapper = this.wrapToolbarItem(aNode, aPlace);
      deferred.resolve(wrapper);
    }.bind(this))

    return deferred.promise;
  },

  wrapToolbarItem: function(aNode, aPlace) {
    if (!this.isCustomizableItem(aNode)) {
      return aNode;
    }
    let wrapper = this.createWrapper(aNode, aPlace);
    // It's possible that this toolbar node is "mid-flight" and doesn't have
    // a parent, in which case we skip replacing it. This can happen if a
    // toolbar item has been dragged into the palette. In that case, we tell
    // CustomizableUI to remove the widget from its area before putting the
    // widget in the palette - so the node will have no parent.
    if (aNode.parentNode) {
      aNode = aNode.parentNode.replaceChild(wrapper, aNode);
    }
    wrapper.appendChild(aNode);
    return wrapper;
  },

  createWrapper: function(aNode, aPlace) {
    let wrapper = this.document.createElement("toolbarpaletteitem");

    // "place" is used by toolkit to add the toolbarpaletteitem-palette
    // binding to a toolbarpaletteitem, which gives it a label node for when
    // it's sitting in the palette.
    wrapper.setAttribute("place", aPlace);

    // Ensure the wrapped item doesn't look like it's in any special state, and
    // can't be interactved with when in the customization palette.
    if (aNode.hasAttribute("command")) {
      wrapper.setAttribute("itemcommand", aNode.getAttribute("command"));
      aNode.removeAttribute("command");
    }

    if (aNode.checked) {
      wrapper.setAttribute("itemchecked", "true");
      aNode.checked = false;
    }

    if (aNode.hasAttribute("id")) {
      wrapper.setAttribute("id", "wrapper-" + aNode.getAttribute("id"));
    }

    if (aNode.hasAttribute("title")) {
      wrapper.setAttribute("title", aNode.getAttribute("title"));
    } else if (aNode.hasAttribute("label")) {
      wrapper.setAttribute("title", aNode.getAttribute("label"));
    }

    if (aNode.hasAttribute("flex")) {
      wrapper.setAttribute("flex", aNode.getAttribute("flex"));
    }

    wrapper.addEventListener("mousedown", this);
    wrapper.addEventListener("mouseup", this);

    return wrapper;
  },

  deferredUnwrapToolbarItem: function(aWrapper) {
    let deferred = Promise.defer();
    dispatchFunction(function() {
      deferred.resolve(this.unwrapToolbarItem(aWrapper));
    }.bind(this));
    return deferred.promise;
  },

  unwrapToolbarItem: function(aWrapper) {
    if (aWrapper.nodeName != "toolbarpaletteitem") {
      return aWrapper;
    }
    aWrapper.removeEventListener("mousedown", this);
    aWrapper.removeEventListener("mouseup", this);

    let toolbarItem = aWrapper.firstChild;
    if (!toolbarItem) {
      ERROR("no toolbarItem child for " + aWrapper.tagName + "#" + aWrapper.id);
    }

    if (aWrapper.hasAttribute("itemchecked")) {
      toolbarItem.checked = true;
    }

    if (aWrapper.hasAttribute("itemcommand")) {
      let commandID = aWrapper.getAttribute("itemcommand");
      toolbarItem.setAttribute("command", commandID);

      //XXX Bug 309953 - toolbarbuttons aren't in sync with their commands after customizing
      let command = this.document.getElementById(commandID);
      if (command && command.hasAttribute("disabled")) {
        toolbarItem.setAttribute("disabled", command.getAttribute("disabled"));
      }
    }

    if (aWrapper.parentNode) {
      aWrapper.parentNode.replaceChild(toolbarItem, aWrapper);
    }
    return toolbarItem;
  },

  _wrapToolbarItems: function() {
    let window = this.window;
    // Add drag-and-drop event handlers to all of the customizable areas.
    return Task.spawn(function() {
      this.areas = [];
      for (let area of CustomizableUI.areas) {
        let target = CustomizableUI.getCustomizeTargetForArea(area, window);
        target.addEventListener("dragstart", this, true);
        target.addEventListener("dragover", this, true);
        target.addEventListener("dragexit", this, true);
        target.addEventListener("drop", this, true);
        target.addEventListener("dragend", this, true);
        for (let child of target.children) {
          if (this.isCustomizableItem(child)) {
            yield this.deferredWrapToolbarItem(child, getPlaceForItem(child));
          }
        }
        this.areas.push(target);
      }
    }.bind(this)).then(null, ERROR);
  },

  _wrapItemsInArea: function(target) {
    for (let child of target.children) {
      if (this.isCustomizableItem(child)) {
        this.wrapToolbarItem(child, getPlaceForItem(child));
      }
    }
  },

  _unwrapItemsInArea: function(target) {
    for (let toolbarItem of target.children) {
      if (this.isWrappedToolbarItem(toolbarItem)) {
        this.unwrapToolbarItem(toolbarItem);
      }
    }
  },

  _unwrapToolbarItems: function() {
    return Task.spawn(function() {
      for (let target of this.areas) {
        for (let toolbarItem of target.children) {
          if (this.isWrappedToolbarItem(toolbarItem)) {
            yield this.deferredUnwrapToolbarItem(toolbarItem);
          }
        }
        target.removeEventListener("dragstart", this, true);
        target.removeEventListener("dragover", this, true);
        target.removeEventListener("dragexit", this, true);
        target.removeEventListener("drop", this, true);
        target.removeEventListener("dragend", this, true);
      }
    }.bind(this)).then(null, ERROR);
  },

  persistCurrentSets: function()  {
    let document = this.document;
    let toolbars = document.querySelectorAll("toolbar[customizable='true'][currentset]");
    for (let toolbar of toolbars) {
      // Persist the currentset attribute directly on hardcoded toolbars.
      document.persist(toolbar.id, "currentset");
    }
  },

  reset: function() {
    this.resetting = true;
    return Task.spawn(function() {
      this._removePanelCustomizationPlaceholders();
      yield this.depopulatePalette();
      yield this._unwrapToolbarItems();

      CustomizableUI.reset();

      yield this._wrapToolbarItems();
      yield this.populatePalette();

      let document = this.document;
      let toolbars = document.querySelectorAll("toolbar[customizable='true']");
      for (let toolbar of toolbars) {
        let set = toolbar.currentSet;
        toolbar.removeAttribute("currentset");
        LOG("[RESET] Removing currentset of " + toolbar.id);
        // Persist the currentset attribute directly on hardcoded toolbars.
        document.persist(toolbar.id, "currentset");
      }

      this._updateResetButton();
      this._showPanelCustomizationPlaceholders();
      this.resetting = false;
    }.bind(this)).then(null, ERROR);
  },

  _onToolbarVisibilityChange: function(aEvent) {
    let toolbar = aEvent.target;
    if (aEvent.detail.visible) {
      toolbar.setAttribute("customizing", "true");
    } else {
      toolbar.removeAttribute("customizing");
    }
  },

  onWidgetMoved: function(aWidgetId, aArea, aOldPosition, aNewPosition) {
    this._onUIChange();
  },

  onWidgetAdded: function(aWidgetId, aArea, aPosition) {
    this._onUIChange();
  },

  onWidgetRemoved: function(aWidgetId, aArea) {
    this._onUIChange();
  },

  onWidgetBeforeDOMChange: function(aNodeToChange, aSecondaryNode, aContainer) {
    if (aContainer.ownerDocument.defaultView != this.window || this.resetting) {
      return;
    }
    if (aContainer.id == CustomizableUI.AREA_PANEL) {
      this._removePanelCustomizationPlaceholders();
    }
    // If we get called for widgets that aren't in the window yet, they might not have
    // a parentNode at all.
    if (aNodeToChange.parentNode) {
      this.unwrapToolbarItem(aNodeToChange.parentNode);
    }
    if (aSecondaryNode) {
      this.unwrapToolbarItem(aSecondaryNode.parentNode);
    }
  },

  onWidgetAfterDOMChange: function(aNodeToChange, aSecondaryNode, aContainer) {
    if (aContainer.ownerDocument.defaultView != this.window || this.resetting) {
      return;
    }
    // If the node is still attached to the container, wrap it again:
    if (aNodeToChange.parentNode) {
      let place = getPlaceForItem(aNodeToChange);
      this.wrapToolbarItem(aNodeToChange, place);
      if (aSecondaryNode) {
        this.wrapToolbarItem(aSecondaryNode, place);
      }
    } else {
      // If not, it got removed.

      // If an API-based widget is removed while customizing, append it to the palette.
      // The _applyDrop code itself will take care of positioning it correctly, if
      // applicable. We need the code to be here so removing widgets using CustomizableUI's
      // API also does the right thing (and adds it to the palette)
      let widgetId = aNodeToChange.id;
      let widget = CustomizableUI.getWidget(widgetId);
      if (widget.provider == CustomizableUI.PROVIDER_API) {
        let paletteItem = this.makePaletteItem(widget, "palette");
        this.visiblePalette.appendChild(paletteItem);
      }
    }
    if (aContainer.id == CustomizableUI.AREA_PANEL) {
      this._showPanelCustomizationPlaceholders();
    }
  },

  _onUIChange: function() {
    this._changed = true;
    this._updateResetButton();
    this.dispatchToolboxEvent("customizationchange");
  },

  _updateResetButton: function() {
    let btn = this.document.getElementById("customization-reset-button");
    btn.disabled = CustomizableUI.inDefaultState;
  },

  handleEvent: function(aEvent) {
    switch(aEvent.type) {
      case "toolbarvisibilitychange":
        this._onToolbarVisibilityChange(aEvent);
        break;
      case "contextmenu":
        aEvent.preventDefault();
        aEvent.stopPropagation();
        break;
      case "dragstart":
        this._onDragStart(aEvent);
        break;
      case "dragover":
        this._onDragOver(aEvent);
        break;
      case "drop":
        this._onDragDrop(aEvent);
        break;
      case "dragexit":
        this._onDragExit(aEvent);
        break;
      case "dragend":
        this._onDragEnd(aEvent);
        break;
      case "mousedown":
        if (aEvent.button == 0 &&
            (aEvent.originalTarget == this.window.PanelUI.menuButton) ||
            (aEvent.originalTarget == this.document.getElementById("tab-view-deck"))) {
          this.exit();
          aEvent.preventDefault();
          return;
        }
        this._onMouseDown(aEvent);
        break;
      case "mouseup":
        this._onMouseUp(aEvent);
        break;
      case "keypress":
        if (aEvent.keyCode == aEvent.DOM_VK_ESCAPE) {
          this.exit();
        }
        break;
    }
  },

  _onDragStart: function(aEvent) {
    __dumpDragData(aEvent);
    let item = aEvent.target;
    while (item && item.localName != "toolbarpaletteitem") {
      if (item.localName == "toolbar" ||
          item.classList.contains(kPlaceholderClass)) {
        return;
      }
      item = item.parentNode;
    }

    let dt = aEvent.dataTransfer;
    let documentId = aEvent.target.ownerDocument.documentElement.id;
    let draggedItem = item.firstChild;

    dt.mozSetDataAt(kDragDataTypePrefix + documentId, draggedItem.id, 0);
    dt.effectAllowed = "move";

    // Hack needed so that the dragimage will still show the
    // item as it appeared before it was hidden.
    let win = aEvent.target.ownerDocument.defaultView;
    win.setTimeout(function() {
      // For automated tests, we sometimes start exiting customization mode
      // before this fires, which leaves us with placeholders inserted after
      // we've exited. So we need to check that we are indeed customizing.
      if (this._customizing && !this._transitioning) {
        item.hidden = true;
        this._showPanelCustomizationPlaceholders();
      }
    }.bind(this), 0);
  },

  _onDragOver: function(aEvent) {
    if (this._isUnwantedDragDrop(aEvent)) {
      return;
    }

    __dumpDragData(aEvent);

    let document = aEvent.target.ownerDocument;
    let documentId = document.documentElement.id;
    if (!aEvent.dataTransfer.mozTypesAt(0)) {
      return;
    }

    let draggedItemId =
      aEvent.dataTransfer.mozGetDataAt(kDragDataTypePrefix + documentId, 0);
    let draggedWrapper = document.getElementById("wrapper-" + draggedItemId);
    let targetArea = this._getCustomizableParent(aEvent.currentTarget);
    let originArea = this._getCustomizableParent(draggedWrapper);

    // Do nothing if the target or origin are not customizable.
    if (!targetArea || !originArea) {
      return;
    }

    // Do nothing if the widget is not allowed to be removed.
    if (targetArea.id == kPaletteId &&
       !CustomizableUI.isWidgetRemovable(draggedItemId)) {
      return;
    }

    // Do nothing if the widget is not allowed to move to the target area.
    if (targetArea.id != kPaletteId &&
        !CustomizableUI.canWidgetMoveToArea(draggedItemId, targetArea.id)) {
      return;
    }

    let targetNode = this._getDragOverNode(aEvent.target, targetArea);
    let targetParent = targetNode.parentNode;

    // We need to determine the place that the widget is being dropped in
    // the target.
    let dragOverItem;
    let atEnd = false;
    if (targetNode == targetArea.customizationTarget) {
      dragOverItem = targetNode.lastChild;
      atEnd = true;
    } else {
      let position = Array.indexOf(targetParent.children, targetNode);
      if (position == -1) {
        dragOverItem = targetParent.lastChild;
      } else {
        dragOverItem = targetParent.children[position];
        // Check if the aDraggedItem is hovered past the first half of dragOverItem
        let window = dragOverItem.ownerDocument.defaultView;
        if (targetParent == window.PanelUI.contents) {
          let direction = window.getComputedStyle(dragOverItem, null).direction;
          let dropTargetCenter = dragOverItem.boxObject.x + (dragOverItem.boxObject.width / 2);
          if (direction == "ltr" && aEvent.clientX > dropTargetCenter)
            position++;
          else if (direction == "rtl" && aEvent.clientX < dropTargetCenter)
            position--;
          dragOverItem = position == -1 ? targetParent.firstChild : targetParent.children[position];
        }
      }
    }

    if (this._dragOverItem && dragOverItem != this._dragOverItem) {
      this._setDragActive(this._dragOverItem, false);
    }

    if (dragOverItem != this._dragOverItem) {
      this._setDragActive(dragOverItem, true, draggedItemId, atEnd);
      this._dragOverItem = dragOverItem;
    }

    aEvent.preventDefault();
    aEvent.stopPropagation();
  },

  _onDragDrop: function(aEvent) {
    if (this._isUnwantedDragDrop(aEvent)) {
      return;
    }

    __dumpDragData(aEvent);

    let targetArea = this._getCustomizableParent(aEvent.currentTarget);
    let document = aEvent.target.ownerDocument;
    let documentId = document.documentElement.id;
    let draggedItemId =
      aEvent.dataTransfer.mozGetDataAt(kDragDataTypePrefix + documentId, 0);
    let draggedWrapper = document.getElementById("wrapper-" + draggedItemId);
    let originArea = this._getCustomizableParent(draggedWrapper);
    if (this._dragWidthMap) {
      this._dragWidthMap.clear();
    }
    // Do nothing if the target area or origin area are not customizable.
    if (!targetArea || !originArea) {
      return;
    }
    let targetNode = this._getDragOverNode(aEvent.target, targetArea);
    // If the target node is a placeholder, get its sibling as the real target.
    while (targetNode.classList.contains(kPlaceholderClass) && targetNode.nextSibling) {
      targetNode = targetNode.nextSibling;
    }
    if (targetNode.tagName == "toolbarpaletteitem") {
      targetNode = targetNode.firstChild;
    }

    this._setDragActive(this._dragOverItem, false);
    this._removePanelCustomizationPlaceholders();

    try {
      this._applyDrop(aEvent, targetArea, originArea, draggedItemId, targetNode);
    } catch (ex) {
      ERROR(ex, ex.stack);
    }

    this._showPanelCustomizationPlaceholders();
  },

  _applyDrop: function(aEvent, aTargetArea, aOriginArea, aDraggedItemId, aTargetNode) {
    let document = aEvent.target.ownerDocument;
    let draggedItem = document.getElementById(aDraggedItemId);
    draggedItem.hidden = false;
    draggedItem.removeAttribute("mousedown");

    // Do nothing if the target was dropped onto itself (ie, no change in area
    // or position).
    if (draggedItem == aTargetNode) {
      return;
    }

    // Is the target area the customization palette?
    if (aTargetArea.id == kPaletteId) {
      // Did we drag from outside the palette?
      if (aOriginArea.id !== kPaletteId) {
        if (!CustomizableUI.isWidgetRemovable(aDraggedItemId)) {
          return;
        }

        CustomizableUI.removeWidgetFromArea(aDraggedItemId);
      }
      draggedItem = draggedItem.parentNode;

      // If the target node is the palette itself, just append
      if (aTargetNode == this.visiblePalette) {
        this.visiblePalette.appendChild(draggedItem);
      } else {
        // The items in the palette are wrapped, so we need the target node's parent here:
        this.visiblePalette.insertBefore(draggedItem, aTargetNode.parentNode);
      }
      return;
    }

    if (!CustomizableUI.canWidgetMoveToArea(aDraggedItemId, aTargetArea.id)) {
      return;
    }

    // Is the target the customization area itself? If so, we just add the
    // widget to the end of the area.
    if (aTargetNode == aTargetArea.customizationTarget) {
      CustomizableUI.addWidgetToArea(aDraggedItemId, aTargetArea.id);
      return;
    }

    // We need to determine the place that the widget is being dropped in
    // the target.
    let placement;
    if (!aTargetNode.classList.contains(kPlaceholderClass)) {
      let targetNodeId = (aTargetNode.nodeName == "toolbarpaletteitem") ?
                            aTargetNode.firstChild && aTargetNode.firstChild.id :
                            aTargetNode.id;
      placement = CustomizableUI.getPlacementOfWidget(targetNodeId);
    }
    if (!placement) {
      LOG("Could not get a position for " + aTargetNode + "#" + aTargetNode.id + "." + aTargetNode.className);
    }
    let position = placement ? placement.position : null;


    // Is the target area the same as the origin? Since we've already handled
    // the possibility that the target is the customization palette, we know
    // that the widget is moving within a customizable area.
    if (aTargetArea == aOriginArea) {
      CustomizableUI.moveWidgetWithinArea(aDraggedItemId, position);
      return;
    }

    CustomizableUI.addWidgetToArea(aDraggedItemId, aTargetArea.id, position);
  },

  _onDragExit: function(aEvent) {
    if (this._isUnwantedDragDrop(aEvent)) {
      return;
    }

    __dumpDragData(aEvent);

    if (this._dragOverItem) {
      this._setDragActive(this._dragOverItem, false);
    }
  },

  _onDragEnd: function(aEvent) {
    if (this._isUnwantedDragDrop(aEvent)) {
      return;
    }

    __dumpDragData(aEvent);
    let document = aEvent.target.ownerDocument;
    document.documentElement.removeAttribute("customizing-movingItem");

    let documentId = document.documentElement.id;
    if (!aEvent.dataTransfer.mozTypesAt(0)) {
      return;
    }

    let draggedItemId =
      aEvent.dataTransfer.mozGetDataAt(kDragDataTypePrefix + documentId, 0);

    let draggedWrapper = document.getElementById("wrapper-" + draggedItemId);
    draggedWrapper.hidden = false;
    draggedWrapper.removeAttribute("mousedown");
    this._showPanelCustomizationPlaceholders();
  },

  _isUnwantedDragDrop: function(aEvent) {
    // The simulated events generated by synthesizeDragStart/synthesizeDrop in
    // mochitests are used only for testing whether the right data is being put
    // into the dataTransfer. Neither cause a real drop to occur, so they don't
    // set the source node. There isn't a means of testing real drag and drops,
    // so this pref skips the check but it should only be set by test code.
    if (this._skipSourceNodeCheck) {
      return false;
    }

    /* Discard drag events that originated from a separate window to
       prevent content->chrome privilege escalations. */
    let mozSourceNode = aEvent.dataTransfer.mozSourceNode;
    // mozSourceNode is null in the dragStart event handler or if
    // the drag event originated in an external application.
    return !mozSourceNode ||
           mozSourceNode.ownerDocument.defaultView != this.window;
  },

  _setDragActive: function(aItem, aValue, aDraggedItemId, aAtEnd) {
    if (!aItem) {
      return;
    }
    let node = aItem;
    let window = aItem.ownerDocument.defaultView;
    let direction = window.getComputedStyle(aItem, null).direction;
    let value = direction == "ltr" ? "left" : "right";
    if (aItem.localName == "toolbar" || aAtEnd) {
      value = direction == "ltr" ? "right" : "left";
      if (aItem.localName == "toolbar") {
        node = aItem.lastChild;
      }
    }

    if (!node) {
      return;
    }

    if (aValue) {
      if (!node.hasAttribute("dragover")) {
        node.setAttribute("dragover", value);

        // Calculate width of the item when it'd be dropped in this position
        let draggedItem = window.document.getElementById(aDraggedItemId);
        let width = this._getDragItemWidth(node, draggedItem);
        if (width) {
          let panelContents = window.PanelUI.contents;
          if (node.parentNode == panelContents) {
            this._setPanelDragActive(node, draggedItem, width);
          } else {
            let prop = value == "left" ? "borderLeftWidth" : "borderRightWidth";
            node.style[prop] = width;
          }
        }
      }
    } else {
      node.removeAttribute("dragover");
      // Remove both property values in the case that the end padding
      // had been set.
      node.style.removeProperty("border-left-width");
      node.style.removeProperty("border-right-width");
    }
  },

  _setPanelDragActive: function(aDragOverNode, aDraggedItem, aWidth) {
    let document = aDragOverNode.ownerDocument;
    let window = document.defaultView;
    let panelContents = window.PanelUI.contents;
    while (!aDragOverNode.id && aDragOverNode.parentNode != panelContents)
        aDragOverNode = aDragOverNode.parentNode;
    if (!aDragOverNode.id)
      return;

    if (!aDragOverNode.previousSibling ||
        !aDragOverNode.previousSibling.classList.contains(kPlaceholderClass)) {
      let isPlaceholderAtEnd = function(aPlaceholder) {
        do {
          aPlaceholder = aPlaceholder.nextSibling;
          if (!aPlaceholder)
            return true;
          if (!aPlaceholder.classList.contains(kPlaceholderClass))
            return false;
        } while (aPlaceholder.nextSibling)
        return true;
      }

      let resetAnimAttributes = function(aPlaceholder) {
        if (!aPlaceholder)
          return;
        aPlaceholder.removeAttribute("expand");
        aPlaceholder.removeAttribute("contract");
        aPlaceholder.removeAttribute("hidden");
        aPlaceholder.style.removeProperty("width");
      }

      let placeholders = Array.slice(panelContents.getElementsByClassName(
        kPlaceholderClass));

      let toContract = placeholders.shift();
      if (isPlaceholderAtEnd(toContract))
        toContract = null;
      let toExpand = placeholders.shift();
      // Seek to find hidden placeholders first to use for the expand transition.
      while (toExpand.getAttribute("hidden") != "true" && placeholders.length)
        toExpand = placeholders.shift();

      if (toExpand.transitioning || (toContract && toContract.transitioning))
        return;

      let wasHidden = (toContract && toContract.getAttribute("hidden") == "true") ||
                      toExpand.getAttribute("hidden") == "true";
      resetAnimAttributes(toContract);
      resetAnimAttributes(toExpand);

      aDragOverNode.parentNode.insertBefore(toExpand, aDragOverNode);
      toExpand.style.width = "0px";
      toExpand.setAttribute("expand", "true");
      toExpand.transitioning = true;
      if (toContract) {
        toContract.style.width = aWidth;
        toContract.setAttribute("contract", "true");
        toContract.transitioning = true;
      }

      window.mozRequestAnimationFrame(() => {
        if (toContract)
          toContract.style.width = "0px";
        toExpand.style.width = aWidth;
      });
      toExpand.addEventListener("transitionend", function expandTransitionEnd() {
        toExpand.removeEventListener("transitionend", expandTransitionEnd, false);
        toExpand.transitioning = false;
      });
      if (toContract) {
        toContract.addEventListener("transitionend", function contractTransitionEnd() {
          toContract.removeEventListener("transitionend", contractTransitionEnd, false);
          panelContents.appendChild(toContract);
          if (wasHidden)
            toContract.setAttribute("hidden", "true");
          toContract.transitioning = false;
        });
      }
    }
  },

  _getDragItemWidth: function(aDragOverNode, aDraggedItem) {
    // Cache it good, cache it real good.
    if (!this._dragWidthMap)
      this._dragWidthMap = new WeakMap();
    if (!this._dragWidthMap.has(aDraggedItem))
      this._dragWidthMap.set(aDraggedItem, new WeakMap());
    let itemMap = this._dragWidthMap.get(aDraggedItem);
    let targetArea = this._getCustomizableParent(aDragOverNode);
    if (!targetArea)
      return;
    // Return the width for this target from cache, if it exists.
    let width = itemMap.get(targetArea);
    if (width)
      return width;

    // Calculate width of the item when it'd be dropped in this position.
    let window = aDragOverNode.ownerDocument.defaultView;
    let currentParent = aDraggedItem.parentNode;
    let currentSibling = aDraggedItem.nextSibling;

    // Move the widget temporarily next to the placeholder.
    aDragOverNode.parentNode.insertBefore(aDraggedItem, aDragOverNode);
    // Update the node's areaType.
    let areaType = CustomizableUI.getAreaType(targetArea.id);
    const kAreaType = "customizableui-areatype";
    let currentType = aDraggedItem.hasAttribute(kAreaType) &&
                      aDraggedItem.getAttribute(kAreaType);
    if (areaType)
      aDraggedItem.setAttribute(kAreaType, areaType);
    CustomizableUI.onWidgetDrag(aDraggedItem.id, targetArea.id);
    // Fetch the new width.
    width = Math.floor(aDraggedItem.getBoundingClientRect().width) + "px";
    // Put the item back into its previous position.
    if (currentSibling)
      currentParent.insertBefore(aDraggedItem, currentSibling);
    else
      currentParent.appendChild(aDraggedItem);
    // restore the areaType
    if (areaType) {
      if (currentType === false)
        aDraggedItem.removeAttribute(kAreaType);
      else
        aDraggedItem.setAttribute(kAreaType, currentType);
    }
    CustomizableUI.onWidgetDrag(aDraggedItem.id);
    // Cache the found value of width for this target.
    itemMap.set(targetArea, width);
    return width;
  },

  _getCustomizableParent: function(aElement) {
    let areas = CustomizableUI.areas;
    areas.push(kPaletteId);
    while (aElement) {
      if (areas.indexOf(aElement.id) != -1) {
        return aElement;
      }
      aElement = aElement.parentNode;
    }
    return null;
  },

  _getDragOverNode: function(aElement, aAreaElement) {
    let expectedParent = aAreaElement.customizationTarget || aAreaElement;
    let targetNode = aElement;
    while (targetNode && targetNode.parentNode != expectedParent) {
      targetNode = targetNode.parentNode;
    }
    return targetNode || aElement;
  },

  _onMouseDown: function(aEvent) {
    LOG("_onMouseDown");
    let doc = aEvent.target.ownerDocument;
    doc.documentElement.setAttribute("customizing-movingItem", true);
    let item = this._getWrapper(aEvent.target);
    if (item) {
      item.setAttribute("mousedown", "true");
    }
  },

  _onMouseUp: function(aEvent) {
    LOG("_onMouseUp");
    let doc = aEvent.target.ownerDocument;
    doc.documentElement.removeAttribute("customizing-movingItem");
    let item = this._getWrapper(aEvent.target);
    if (item) {
      item.removeAttribute("mousedown");
    }
  },

  _getWrapper: function(aElement) {
    while (aElement && aElement.localName != "toolbarpaletteitem") {
      if (aElement.localName == "toolbar")
        return null;
      aElement = aElement.parentNode;
    }
    return aElement;
  },

  _showPanelCustomizationPlaceholders: function() {
    this._removePanelCustomizationPlaceholders();
    let doc = this.document;
    let contents = this.panelUIContents;
    let visibleCombinedButtons = contents.querySelectorAll("toolbarpaletteitem:not([hidden]) > .panel-combined-item");
    let visibleChildren = contents.querySelectorAll("toolbarpaletteitem:not([hidden])");
    // TODO(bug 885578): Still doesn't handle a hole when there is a wide
    //                   widget located at the bottom of the panel.
    let hangingItems = (visibleChildren.length - visibleCombinedButtons.length) % kColumnsInMenuPanel;
    let newPlaceholders = kColumnsInMenuPanel;
    let visiblePlaceholders = kColumnsInMenuPanel - hangingItems;
    while (newPlaceholders--) {
      let placeholder = doc.createElement("toolbarpaletteitem");
      placeholder.classList.add(kPlaceholderClass);
      //XXXjaws The toolbarbutton child here is only necessary to get
      //  the styling right here.
      let placeholderChild = doc.createElement("toolbarbutton");
      placeholderChild.classList.add(kPlaceholderClass + "-child");
      placeholder.appendChild(placeholderChild);
      // Always have at least 1 placeholder visible.
      placeholder.setAttribute("hidden", --visiblePlaceholders < 0);
      contents.appendChild(placeholder);
    }
  },

  _removePanelCustomizationPlaceholders: function() {
    let contents = this.panelUIContents;
    let oldPlaceholders = contents.getElementsByClassName(kPlaceholderClass);
    while (oldPlaceholders.length) {
      contents.removeChild(oldPlaceholders[0]);
    }
  }
};

function getPlaceForItem(aElement) {
  let place;
  let node = aElement;
  while (node && !place) {
    if (node.localName == "toolbar")
      place = "toolbar";
    else if (node.id == CustomizableUI.AREA_PANEL)
      place = "panel";
    else if (node.id == kPaletteId)
      place = "palette";

    node = node.parentNode;
  }
  return place;
}

function __dumpDragData(aEvent, caller) {
  let str = "Dumping drag data (CustomizeMode.jsm) {\n";
  str += "  type: " + aEvent["type"] + "\n";
  for (let el of ["target", "currentTarget", "relatedTarget"]) {
    if (aEvent[el]) {
      str += "  " + el + ": " + aEvent[el] + "(localName=" + aEvent[el].localName + "; id=" + aEvent[el].id + ")\n";
    }
  }
  for (let prop in aEvent.dataTransfer) {
    if (typeof aEvent.dataTransfer[prop] != "function") {
      str += "  dataTransfer[" + prop + "]: " + aEvent.dataTransfer[prop] + "\n";
    }
  }
  str += "}";
  LOG(str);
}

function dispatchFunction(aFunc) {
  Services.tm.currentThread.dispatch(aFunc, Ci.nsIThread.DISPATCH_NORMAL);
}
