/* vim: set ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */

// Test that image nodes have the "copy data-uri" contextual menu item enabled
// and that clicking it puts the image data into the clipboard

let doc;
let inspector;
let markup;

const PAGE_CONTENT = [
  '<div></div>',
  '<img class="data" src="data:image/png;base64,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" />',
  '<canvas class="canvas" width="600" height="600"></canvas>'
].join("\n");

function test() {
  waitForExplicitFinish();

  gBrowser.selectedTab = gBrowser.addTab();
  gBrowser.selectedBrowser.addEventListener("load", function onload(evt) {
    gBrowser.selectedBrowser.removeEventListener("load", onload, true);
    doc = content.document;
    waitForFocus(createDocument, content);
  }, true);

  content.location = "data:text/html,markup view copy image as data-uri";
}

function createDocument() {
  doc.body.innerHTML = PAGE_CONTENT;
  let context = doc.querySelector(".canvas").getContext("2d");
  context.beginPath();
  context.moveTo(300, 0);
  context.lineTo(600, 600);
  context.lineTo(0, 600);
  context.closePath();
  context.fillStyle = "#ffc821";
  context.fill();

  openInspector().then(startTests);
}

function startTests({inspector: aInspector, toolbox: aToolbox}) {
  inspector = aInspector;
  markup = inspector.markup;

  Task.spawn(function() {
    yield selectNode("div", inspector);
    yield assertCopyImageDataNotAvailable();

    yield selectNode("img", inspector);
    yield assertCopyImageDataAvailable();
    yield triggerCopyImageUrlAndWaitForClipboard(doc.querySelector("img").src);

    yield selectNode("canvas", inspector);
    yield assertCopyImageDataAvailable();
    let canvas = doc.querySelector(".canvas");
    yield triggerCopyImageUrlAndWaitForClipboard(canvas.toDataURL());

    // Check again that the menu isn't available on the DIV (to make sure our
    // menu updating mechanism works)
    yield selectNode("div", inspector);
    yield assertCopyImageDataNotAvailable();
  }).then(null, ok.bind(null, false)).then(endTests);
}

function endTests() {
  doc = inspector = markup = null;
  gBrowser.removeCurrentTab();
  finish();
}

function assertCopyImageDataNotAvailable() {
  return openNodeMenu().then(menu => {
    let item = menu.getElementsByAttribute("id", "node-menu-copyimagedatauri")[0];
    ok(item, "The menu item was found in the contextual menu");
    is(item.getAttribute("disabled"), "true", "The menu item is disabled");
  }).then(closeNodeMenu);
}

function assertCopyImageDataAvailable() {
  return openNodeMenu().then(menu => {
    let item = menu.getElementsByAttribute("id", "node-menu-copyimagedatauri")[0];
    ok(item, "The menu item was found in the contextual menu");
    is(item.getAttribute("disabled"), "", "The menu item is enabled");
  }).then(closeNodeMenu);
}

function openNodeMenu() {
  let deferred = promise.defer();

  inspector.nodemenu.addEventListener("popupshown", function onOpen() {
    inspector.nodemenu.removeEventListener("popupshown", onOpen, false);
    deferred.resolve(inspector.nodemenu);
  }, false);
  inspector.nodemenu.hidden = false;
  inspector.nodemenu.openPopup();

  return deferred.promise;
}

function closeNodeMenu() {
  let deferred = promise.defer();

  inspector.nodemenu.addEventListener("popuphidden", function onClose() {
    inspector.nodemenu.removeEventListener("popuphidden", onClose, false);
    deferred.resolve(inspector.nodemenu);
  }, false);
  inspector.nodemenu.hidden = true;
  inspector.nodemenu.hidePopup();

  return deferred.promise;
}

function triggerCopyImageUrlAndWaitForClipboard(expected) {
  let deferred = promise.defer();

  SimpleTest.waitForClipboard(expected, () => {
    markup.getContainer(inspector.selection.nodeFront).copyImageDataUri();
  }, () => {
    ok(true, "The clipboard contains the expected value " + expected.substring(0, 50) + "...");
    deferred.resolve();
  }, () => {
    ok(false, "The clipboard doesn't contain the expected value " + expected.substring(0, 50) + "...");
    deferred.resolve();
  });

  return deferred.promise;
}
