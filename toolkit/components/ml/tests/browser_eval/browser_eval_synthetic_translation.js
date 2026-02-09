/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const evalMetadata = {
  owner: "ML Team",
  name: "Synthetic Translation Eval",
  description:
    "Synthetic translation output to validate the evaluation harness wiring.",
  test: "mochitest",
  options: {
    default: {
      manifest: "eval.toml",
      manifest_flavor: "browser-chrome",
      perfherder: true,
      perfherder_metrics: [
        {
          name: "bleu",
          unit: "bleu",
          lowerIsBetter: false,
          shouldAlert: false,
        },
        {
          name: "chrF",
          unit: "chrF",
          lowerIsBetter: false,
          shouldAlert: false,
        },
      ],
    },
  },
};

function reportEvalData(data) {
  info("evalDataPayload | " + JSON.stringify(data));
}

add_task(async function test_synthetic_translation_eval() {
  const src = "Bonjour le monde";
  const trg = "Hello the world";
  const ref = "Hello world";

  reportEvalData({
    type: "translation",
    langPair: { src: "fr", trg: "en" },
    src,
    trg,
    ref,
  });

  ok(true, "Synthetic eval result recorded.");
});
