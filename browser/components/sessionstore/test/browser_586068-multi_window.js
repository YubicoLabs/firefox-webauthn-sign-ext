/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF_RESTORE_ON_DEMAND = "browser.sessionstore.restore_on_demand";

function test() {
  TestRunner.run();
}

function runTests() {
  Services.prefs.setBoolPref(PREF_RESTORE_ON_DEMAND, false);
  registerCleanupFunction(function () {
    Services.prefs.clearUserPref(PREF_RESTORE_ON_DEMAND);
  });

  // The first window will be put into the already open window and the second
  // window will be opened with _openWindowWithState, which is the source of the problem.
  let state = { windows: [
    {
      tabs: [
        { entries: [{ url: "http://example.org#0" }], extData: { "uniq": r() } }
      ],
      selected: 1
    },
    {
      tabs: [
        { entries: [{ url: "http://example.com#1" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.com#2" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.com#3" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.com#4" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.com#5" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.com#6" }], extData: { "uniq": r() } }
      ],
      selected: 4
    }
  ] };
  let numTabs = state.windows[0].tabs.length + state.windows[1].tabs.length;

  let loadCount = 0;
  gProgressListener.setCallback(function (aBrowser, aNeedRestore, aRestoring, aRestored) {
    if (++loadCount == numTabs) {
      // We don't actually care about load order in this test, just that they all
      // do load.
      is(loadCount, numTabs, "all tabs were restored");
      is(aNeedRestore, 0, "there are no tabs left needing restore");

      gProgressListener.unsetCallback();
      executeSoon(next);
    }
  });

  // We also want to catch the 2nd window, so we need to observe domwindowopened
  Services.ww.registerNotification(function observer(aSubject, aTopic, aData) {
    if (aTopic == "domwindowopened") {
      let win = aSubject.QueryInterface(Ci.nsIDOMWindow);
      win.addEventListener("load", function onLoad() {
        win.removeEventListener("load", onLoad);
        Services.ww.unregisterNotification(observer);
        win.gBrowser.addTabsProgressListener(gProgressListener);
      });
    }
  });

  yield ss.setBrowserState(JSON.stringify(state));
}
