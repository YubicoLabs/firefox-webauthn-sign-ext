/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_enable_disable() {
  SpecialPowers.pushPrefEnv({
    set: [["browser.tabs.notes.enabled", true]],
  });

  info("set up a tab with a tab note");
  const tab = BrowserTestUtils.addTab(gBrowser, "https://www.example.com/");
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  let tabNoteCreated = BrowserTestUtils.waitForEvent(tab, "TabNote:Created");
  await Promise.all([tabNoteCreated, TabNotes.set(tab, "Test note text")]);

  Assert.ok(tab.hasTabNote, "tab should indicate it has a tab note");

  info("disable tab notes and ensure the tab no longer reflects the note");
  let tabNotesDisabled = TestUtils.topicObserved("TabNote:Disabled");
  let doesNotHaveTabNote = tabNoteIndicatorDisappears(tab);
  SpecialPowers.pushPrefEnv({
    set: [["browser.tabs.notes.enabled", false]],
  });
  await Promise.all([tabNotesDisabled, doesNotHaveTabNote]);

  Assert.ok(!tab.hasTabNote, "tab should no longer indicate it has a tab note");

  info("enable tab notes and ensure the tab once again reflects the note");
  let tabNotesEnabled = TestUtils.topicObserved("TabNote:Enabled");
  let hasTabNote = tabNoteIndicatorAppears(tab);
  SpecialPowers.pushPrefEnv({
    set: [["browser.tabs.notes.enabled", true]],
  });
  await Promise.all([tabNotesEnabled, hasTabNote]);

  Assert.ok(tab.hasTabNote, "tab should once again indicate it has a tab note");

  BrowserTestUtils.removeTab(tab);
  await TabNotes.reset();
});
