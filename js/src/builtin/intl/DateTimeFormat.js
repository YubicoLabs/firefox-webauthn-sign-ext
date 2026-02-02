/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Intl.DateTimeFormat.prototype.formatToParts ( date )
 *
 * Spec: ECMAScript Internationalization API Specification, 12.4.4.
 */
function Intl_DateTimeFormat_formatToParts(date) {
  // Step 1.
  var dtf = this;

  // Steps 2-3.
  if (!IsObject(dtf) || (dtf = intl_GuardToDateTimeFormat(dtf)) === null) {
    return callFunction(
      intl_CallDateTimeFormatMethodIfWrapped,
      this,
      date,
      "Intl_DateTimeFormat_formatToParts"
    );
  }

  // Steps 4-6.
  return intl_FormatDateTime(dtf, date, /* formatToParts = */ true);
}

/**
 * Intl.DateTimeFormat.prototype.formatRange ( startDate , endDate )
 *
 * Spec: Intl.DateTimeFormat.prototype.formatRange proposal
 */
function Intl_DateTimeFormat_formatRange(startDate, endDate) {
  // Step 1.
  var dtf = this;

  // Step 2.
  if (!IsObject(dtf) || (dtf = intl_GuardToDateTimeFormat(dtf)) === null) {
    return callFunction(
      intl_CallDateTimeFormatMethodIfWrapped,
      this,
      startDate,
      endDate,
      "Intl_DateTimeFormat_formatRange"
    );
  }

  // Step 3.
  if (startDate === undefined || endDate === undefined) {
    ThrowTypeError(
      JSMSG_UNDEFINED_DATE,
      startDate === undefined ? "start" : "end",
      "formatRange"
    );
  }

  // Steps 4-6.
  return intl_FormatDateTimeRange(dtf, startDate, endDate, /* formatToParts = */ false);
}

/**
 * Intl.DateTimeFormat.prototype.formatRangeToParts ( startDate , endDate )
 *
 * Spec: Intl.DateTimeFormat.prototype.formatRange proposal
 */
function Intl_DateTimeFormat_formatRangeToParts(startDate, endDate) {
  // Step 1.
  var dtf = this;

  // Step 2.
  if (!IsObject(dtf) || (dtf = intl_GuardToDateTimeFormat(dtf)) === null) {
    return callFunction(
      intl_CallDateTimeFormatMethodIfWrapped,
      this,
      startDate,
      endDate,
      "Intl_DateTimeFormat_formatRangeToParts"
    );
  }

  // Step 3.
  if (startDate === undefined || endDate === undefined) {
    ThrowTypeError(
      JSMSG_UNDEFINED_DATE,
      startDate === undefined ? "start" : "end",
      "formatRangeToParts"
    );
  }

  // Steps 4-6.
  return intl_FormatDateTimeRange(dtf, startDate, endDate, /* formatToParts = */ true);
}
