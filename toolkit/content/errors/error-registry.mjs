/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Central registry for network and certificate error page configurations.
 *
 * This module provides a data-driven approach to error handling, replacing
 * scattered switch statements with a centralized configuration registry.
 * Each error code maps to a configuration object that defines its UI behavior,
 * localization strings, and user actions.
 */

const ERROR_REGISTRY = new Map();

/**
 * Default fallback configuration for unknown error codes.
 */
export const DEFAULT_ERROR_CONFIG = Object.freeze({
  errorCode: "GENERIC",
  category: "net",
  bodyTitleL10nId: "generic-title",
  shortDescriptionL10nId: null,
  descriptionParts: [{ tag: "p", l10nId: "neterror-generic-error" }],
  buttons: {
    showTryAgain: true,
    showGoBack: false,
    showAdvanced: false,
    showAddException: false,
    showPrefReset: false,
    showOpenPortal: false,
  },
  hasNoUserFix: false,
  learnMoreSupportPage: null,
  titleL10nId: "fp-certerror-body-title",
  image: "chrome://global/skin/illustrations/security-error.svg",
});

/**
 * Register an error configuration in the registry.
 *
 * @param {object} config - The error configuration object
 */
export function registerError(config) {
  if (!config.errorCode) {
    throw new Error("Error configuration must have an errorCode");
  }
  ERROR_REGISTRY.set(config.errorCode, Object.freeze(config));
}

/**
 * Register multiple error configurations at once.
 *
 * @param {Array<object>} configs - Array of error configuration objects
 */
export function registerErrors(configs) {
  for (const config of configs) {
    registerError(config);
  }
}

/**
 * Get the configuration for a specific error code.
 *
 * @param {string} errorCode - The error code to look up
 * @returns {object} The error configuration, or DEFAULT_ERROR_CONFIG if not found
 */
export function getErrorConfig(errorCode) {
  return ERROR_REGISTRY.get(errorCode) ?? DEFAULT_ERROR_CONFIG;
}

/**
 * Check if an error code is registered in the registry.
 *
 * @param {string} errorCode - The error code to check
 * @returns {boolean} True if the error is registered
 */
export function isErrorSupported(errorCode) {
  return ERROR_REGISTRY.has(errorCode);
}

/**
 * Get all error configurations for a specific category.
 *
 * @param {string} category - The category to filter by ("cert", "net", "blocked")
 * @returns {Array<object>} Array of error configurations in the category
 */
export function getErrorsByCategory(category) {
  return [...ERROR_REGISTRY.values()].filter(e => e.category === category);
}

/**
 * Get all registered error codes.
 *
 * @returns {Array<string>} Array of error code strings
 */
export function getAllErrorCodes() {
  return [...ERROR_REGISTRY.keys()];
}

/**
 * Get the total number of registered errors.
 *
 * @returns {number} Count of registered errors
 */
export function getErrorCount() {
  return ERROR_REGISTRY.size;
}

// Test-only functions for mocking and resetting
export function _testOnlyClearRegistry() {
  ERROR_REGISTRY.clear();
}

/**
 * Initialize the registry with all error definitions.
 * This function should be called once when the module is first loaded
 * in a context that needs the full error set.
 */
export async function initializeRegistry() {
  if (ERROR_REGISTRY.size > 0) {
    return; // Already initialized
  }

  const [{ CERT_ERRORS }, { PKIX_ERRORS }, { SSL_ERRORS }, { NET_ERRORS }] =
    await Promise.all([
      import("chrome://global/content/errors/cert-errors.mjs"),
      import("chrome://global/content/errors/pkix-errors.mjs"),
      import("chrome://global/content/errors/ssl-errors.mjs"),
      import("chrome://global/content/errors/net-errors.mjs"),
    ]);

  registerErrors(CERT_ERRORS);
  registerErrors(PKIX_ERRORS);
  registerErrors(SSL_ERRORS);
  registerErrors(NET_ERRORS);
}
