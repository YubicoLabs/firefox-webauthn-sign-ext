/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * Bug 1993517 - onlinebank.resursbank.se - extra browser tabs for bankid logins remain open
 *
 * We can open the external app link in the same tab rather than a _blank tab.
 * Chrome and Safari seem to autoclose such tabs incorrectly.
 */

if (!window.__firefoxWebCompatFixBug1993517) {
  Object.defineProperty(window, "__firefoxWebCompatFixBug1993517", {
    configurable: false,
    value: true,
  });

  console.info(
    'Dropping target="_blank" attribute for bankid logins for compatibility reasons. See https://bugzilla.mozilla.org/show_bug.cgi?id=1993517 for details.'
  );

  if (/Win32|Win64|Windows|WinCE/i.test(navigator.platform)) {
    const nav = Object.getPrototypeOf(navigator);
    const platform = Object.getOwnPropertyDescriptor(nav, "platform");
    platform.get = () => "MacIntel";
    Object.defineProperty(nav, "platform", platform);
  }

  document.addEventListener(
    "click",
    e => e.target?.closest("a[href^='bankid://']")?.removeAttribute("target"),
    true
  );
}
