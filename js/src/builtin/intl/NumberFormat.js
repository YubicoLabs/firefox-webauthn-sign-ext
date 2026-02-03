/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Portions Copyright Norbert Lindenberg 2011-2012. */

/* eslint-disable complexity */
/**
 * 15.1.3 SetNumberFormatDigitOptions ( intlObj, options, mnfdDefault, mxfdDefault, notation )
 *
 * Applies digit options used for number formatting onto the intl object.
 *
 * ES2024 Intl draft rev a1db4567870dbe505121a4255f1210338757190a
 */
function SetNumberFormatDigitOptions(
  lazyData,
  options,
  mnfdDefault,
  mxfdDefault,
  notation
) {
  assert(IsObject(options), "SetNumberFormatDigitOptions");
  assert(typeof mnfdDefault === "number", "SetNumberFormatDigitOptions");
  assert(typeof mxfdDefault === "number", "SetNumberFormatDigitOptions");
  assert(mnfdDefault <= mxfdDefault, "SetNumberFormatDigitOptions");
  assert(typeof notation === "string", "SetNumberFormatDigitOptions");

  // Steps 1-5.
  var mnid = GetNumberOption(options, "minimumIntegerDigits", 1, 21, 1);
  var mnfd = options.minimumFractionDigits;
  var mxfd = options.maximumFractionDigits;
  var mnsd = options.minimumSignificantDigits;
  var mxsd = options.maximumSignificantDigits;

  // Step 6.
  lazyData.minimumIntegerDigits = mnid;

  // Step 7.
  var roundingIncrement = GetNumberOption(
    options,
    "roundingIncrement",
    1,
    5000,
    1
  );

  // Step 8.
  switch (roundingIncrement) {
    case 1:
    case 2:
    case 5:
    case 10:
    case 20:
    case 25:
    case 50:
    case 100:
    case 200:
    case 250:
    case 500:
    case 1000:
    case 2000:
    case 2500:
    case 5000:
      break;
    default:
      ThrowRangeError(
        JSMSG_INVALID_OPTION_VALUE,
        "roundingIncrement",
        roundingIncrement
      );
  }

  // Step 9.
  var roundingMode = GetOption(
    options,
    "roundingMode",
    "string",
    [
      "ceil",
      "floor",
      "expand",
      "trunc",
      "halfCeil",
      "halfFloor",
      "halfExpand",
      "halfTrunc",
      "halfEven",
    ],
    "halfExpand"
  );

  // Step 10.
  var roundingPriority = GetOption(
    options,
    "roundingPriority",
    "string",
    ["auto", "morePrecision", "lessPrecision"],
    "auto"
  );

  // Step 11.
  var trailingZeroDisplay = GetOption(
    options,
    "trailingZeroDisplay",
    "string",
    ["auto", "stripIfInteger"],
    "auto"
  );

  // Step 12. (This step is a note.)

  // Step 13.
  if (roundingIncrement !== 1) {
    mxfdDefault = mnfdDefault;
  }

  // Step 14.
  lazyData.roundingIncrement = roundingIncrement;

  // Step 15.
  lazyData.roundingMode = roundingMode;

  // Step 16.
  lazyData.trailingZeroDisplay = trailingZeroDisplay;

  // Step 17.
  var hasSignificantDigits = mnsd !== undefined || mxsd !== undefined;

  // Step 28.
  var hasFractionDigits = mnfd !== undefined || mxfd !== undefined;

  // Steps 19 and 21.a.
  var needSignificantDigits =
    roundingPriority !== "auto" || hasSignificantDigits;

  // Steps 20 and 21.b.i.
  var needFractionalDigits =
    roundingPriority !== "auto" ||
    !(hasSignificantDigits || (!hasFractionDigits && notation === "compact"));

  // Step 22.
  if (needSignificantDigits) {
    // Step 22.a.
    if (hasSignificantDigits) {
      // Step 22.a.i.
      mnsd = DefaultNumberOption(mnsd, 1, 21, 1);
      lazyData.minimumSignificantDigits = mnsd;

      // Step 22.a.ii.
      mxsd = DefaultNumberOption(mxsd, mnsd, 21, 21);
      lazyData.maximumSignificantDigits = mxsd;
    } else {
      // Step 22.b.i.
      lazyData.minimumSignificantDigits = 1;

      // Step 22.b.ii.
      lazyData.maximumSignificantDigits = 21;
    }
  }

  // Step 23.
  if (needFractionalDigits) {
    // Step 23.a.
    if (hasFractionDigits) {
      // Step 23.a.i.
      mnfd = DefaultNumberOption(mnfd, 0, 100, undefined);

      // Step 23.a.ii.
      mxfd = DefaultNumberOption(mxfd, 0, 100, undefined);

      // Step 23.a.iii.
      if (mnfd === undefined) {
        assert(
          mxfd !== undefined,
          "mxfd isn't undefined when mnfd is undefined"
        );
        mnfd = std_Math_min(mnfdDefault, mxfd);
      }

      // Step 23.a.iv.
      else if (mxfd === undefined) {
        mxfd = std_Math_max(mxfdDefault, mnfd);
      }

      // Step 23.a.v.
      else if (mnfd > mxfd) {
        ThrowRangeError(JSMSG_INVALID_DIGITS_VALUE, mxfd);
      }

      // Step 23.a.vi.
      lazyData.minimumFractionDigits = mnfd;

      // Step 23.a.vii.
      lazyData.maximumFractionDigits = mxfd;
    } else {
      // Step 23.b.i.
      lazyData.minimumFractionDigits = mnfdDefault;

      // Step 23.b.ii.
      lazyData.maximumFractionDigits = mxfdDefault;
    }
  }

  // Steps 24-28.
  if (!needSignificantDigits && !needFractionalDigits) {
    assert(!hasSignificantDigits, "bad significant digits in fallback case");
    assert(
      roundingPriority === "auto",
      `bad rounding in fallback case: ${roundingPriority}`
    );
    assert(
      notation === "compact",
      `bad notation in fallback case: ${notation}`
    );

    // Steps 24.a-f.
    lazyData.minimumFractionDigits = 0;
    lazyData.maximumFractionDigits = 0;
    lazyData.minimumSignificantDigits = 1;
    lazyData.maximumSignificantDigits = 2;
    lazyData.roundingPriority = "morePrecision";
  } else {
    // Steps 25-28.
    //
    // Our implementation stores |roundingPriority| instead of using
    // [[RoundingType]].
    lazyData.roundingPriority = roundingPriority;
  }

  // Step 29.
  if (roundingIncrement !== 1) {
    // Step 29.a.
    //
    // [[RoundingType]] is `fractionDigits` if |roundingPriority| is equal to
    // "auto" and |hasSignificantDigits| is false.
    if (roundingPriority !== "auto") {
      ThrowTypeError(
        JSMSG_INVALID_NUMBER_OPTION,
        "roundingIncrement",
        "roundingPriority"
      );
    }
    if (hasSignificantDigits) {
      ThrowTypeError(
        JSMSG_INVALID_NUMBER_OPTION,
        "roundingIncrement",
        "minimumSignificantDigits"
      );
    }

    // Step 29.b.
    //
    // Minimum and maximum fraction digits must be equal.
    if (
      lazyData.minimumFractionDigits !==
      lazyData.maximumFractionDigits
    ) {
      ThrowRangeError(JSMSG_UNEQUAL_FRACTION_DIGITS);
    }
  }
}
/* eslint-enable complexity */
