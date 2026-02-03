/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * 16.3.3 Intl.PluralRules.prototype.select ( value )
 *
 * Returns a String value representing the plural category matching
 * the number passed as value according to the
 * effective locale and the formatting options of this PluralRules.
 *
 * ES2024 Intl draft rev 74ca7099f103d143431b2ea422ae640c6f43e3e6
 */
function Intl_PluralRules_select(value) {
  // Step 1.
  var pluralRules = this;

  // Step 2.
  if (
    !IsObject(pluralRules) ||
    (pluralRules = intl_GuardToPluralRules(pluralRules)) === null
  ) {
    return callFunction(
      intl_CallPluralRulesMethodIfWrapped,
      this,
      value,
      "Intl_PluralRules_select"
    );
  }

  // Step 3.
  var n = TO_NUMBER(value);

  // Step 4.
  return intl_SelectPluralRule(pluralRules, n);
}

/**
 * 16.3.4 Intl.PluralRules.prototype.selectRange ( start, end )
 *
 * Returns a String value representing the plural category matching the input
 * number range according to the effective locale and the formatting options
 * of this PluralRules.
 *
 * ES2024 Intl draft rev 74ca7099f103d143431b2ea422ae640c6f43e3e6
 */
function Intl_PluralRules_selectRange(start, end) {
  // Step 1.
  var pluralRules = this;

  // Step 2.
  if (
    !IsObject(pluralRules) ||
    (pluralRules = intl_GuardToPluralRules(pluralRules)) === null
  ) {
    return callFunction(
      intl_CallPluralRulesMethodIfWrapped,
      this,
      start,
      end,
      "Intl_PluralRules_selectRange"
    );
  }

  // Step 3.
  if (start === undefined || end === undefined) {
    ThrowTypeError(
      JSMSG_UNDEFINED_NUMBER,
      start === undefined ? "start" : "end",
      "PluralRules",
      "selectRange"
    );
  }

  // Step 4.
  var x = TO_NUMBER(start);

  // Step 5.
  var y = TO_NUMBER(end);

  // Step 6.
  return intl_SelectPluralRuleRange(pluralRules, x, y);
}
