/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Utilities for looking up error configurations and resolving dynamic content.
 *
 * Some error configurations require runtime data (e.g., hostname, certificate
 * validity dates, connectivity status). This module provides resolver functions
 * that inject runtime context into static configurations.
 */

import { getErrorConfig, isErrorSupported } from "./error-registry.mjs";

/**
 * Map of error codes to their custom mappings.
 * Some URL parameter error codes map to different internal error codes.
 */
export const CUSTOM_ERROR_CODE_MAP = {
  blockedByCOOP: "NS_ERROR_DOM_COOP_FAILED",
  blockedByCOEP: "NS_ERROR_DOM_COEP_FAILED",
  basicHttpAuthDisabled: "NS_ERROR_BASIC_HTTP_AUTH_DISABLED",
  netReset: "NS_ERROR_NET_EMPTY_RESPONSE",
};

/**
 * Find the supported error code for the given error info.
 * Handles custom mappings and offline state.
 *
 * @param {object} errorInfo - Error info from document.getFailedCertSecurityInfo() or getNetErrorInfo()
 * @param {string} gErrorCode - The URL parameter error code
 * @param {boolean} isOffline - Whether the browser is offline
 * @returns {string|null} The supported error code, or null if not supported
 */
export function findSupportedErrorCode(errorInfo, gErrorCode, isOffline) {
  const defaultErrorCode = errorInfo?.errorCodeString ?? gErrorCode;

  if (isErrorSupported(defaultErrorCode)) {
    return defaultErrorCode;
  }

  if (isOffline && isErrorSupported("NS_ERROR_OFFLINE")) {
    return "NS_ERROR_OFFLINE";
  }

  const customCode = CUSTOM_ERROR_CODE_MAP[defaultErrorCode];
  if (customCode && isErrorSupported(customCode)) {
    return customCode;
  }

  return null;
}

/**
 * Check if an error has no action the user can take to fix it.
 *
 * @param {string} errorCode - The error code to check
 * @returns {boolean} True if the error has no user fix
 */
export function errorHasNoUserFix(errorCode) {
  const config = getErrorConfig(errorCode);
  return config.hasNoUserFix === true;
}

/**
 * Check if an error is supported by the Felt Privacy v1 experience.
 *
 * @param {string} errorCode - The error code to check
 * @returns {boolean} True if the error has intro content for Felt Privacy
 */
export function isFeltPrivacySupported(errorCode) {
  const config = getErrorConfig(errorCode);
  return config.introContent !== undefined;
}

/**
 * Resolve l10n arguments by injecting runtime context.
 *
 * @param {object | null} l10nConfig - The l10n config with { id, args }
 * @param {object} context - Runtime context (hostname, errorInfo, etc.)
 * @returns {object | null} Resolved l10n config with args filled in
 */
export function resolveL10nArgs(l10nConfig, context) {
  if (!l10nConfig) {
    return null;
  }

  if (!l10nConfig.args) {
    return l10nConfig;
  }

  const resolvedArgs = { ...l10nConfig.args };

  for (const [key, value] of Object.entries(resolvedArgs)) {
    if (value === null) {
      // Null values are placeholders to be filled from context
      if (key === "hostname" && context.hostname) {
        resolvedArgs[key] = context.hostname;
      } else if (key === "date" && context.errorInfo) {
        // For date placeholders, determine from cert validity
        resolvedArgs[key] = context.errorInfo.validNotAfter ?? Date.now();
      }
    }
  }

  return {
    id: l10nConfig.id,
    args: resolvedArgs,
  };
}

/**
 * Resolve description parts by calling resolver functions for dynamic content.
 *
 * @param {Array|string} descriptionParts - Static parts array or resolver name
 * @param {object} context - Runtime context
 * @returns {Array} Resolved description parts
 */
export function resolveDescriptionParts(descriptionParts, context) {
  if (!descriptionParts) {
    return [];
  }

  if (typeof descriptionParts === "string") {
    // It's a resolver name - call the resolver
    const resolver = DESCRIPTION_RESOLVERS[descriptionParts];
    if (resolver) {
      return resolver(context);
    }
    return [];
  }

  // Static parts - resolve any l10n args
  return descriptionParts.map(part => {
    if (part.l10nArgs) {
      return {
        ...part,
        l10nArgs: resolveL10nArgs({ args: part.l10nArgs }, context)?.args,
      };
    }
    return part;
  });
}

/**
 * Resolver functions for dynamic description content.
 * These handle cases where description varies based on runtime state.
 */
const DESCRIPTION_RESOLVERS = {
  dnsNotFoundDescription(context) {
    if (context.noConnectivity) {
      return [
        { tag: "span", l10nId: "neterror-dns-not-found-offline-hint-header" },
        {
          tag: "li",
          l10nId: "neterror-dns-not-found-offline-hint-different-device",
        },
        { tag: "li", l10nId: "neterror-dns-not-found-offline-hint-modem" },
        { tag: "li", l10nId: "neterror-dns-not-found-offline-hint-reconnect" },
      ];
    }
    return [
      { tag: "span", l10nId: "neterror-dns-not-found-hint-header" },
      { tag: "li", l10nId: "neterror-dns-not-found-hint-try-again" },
      { tag: "li", l10nId: "neterror-dns-not-found-hint-check-network" },
      { tag: "li", l10nId: "neterror-dns-not-found-hint-firewall" },
    ];
  },

  connectionFailureDescription(context) {
    const parts = [
      { tag: "li", l10nId: "neterror-load-error-try-again" },
      { tag: "li", l10nId: "neterror-load-error-connection" },
      { tag: "li", l10nId: "neterror-load-error-firewall" },
    ];
    if (context.showOSXPermissionWarning) {
      parts.push({ tag: "li", l10nId: "neterror-load-osx-permission" });
    }
    return parts;
  },
};

/**
 * Resolver functions for dynamic advanced section content.
 */
const ADVANCED_RESOLVERS = {
  expiredCertWhyDangerous(context) {
    const { errorInfo } = context;
    if (!errorInfo) {
      return null;
    }

    const isNotYetValid =
      errorInfo.validNotBefore && Date.now() < errorInfo.validNotBefore;

    if (isNotYetValid) {
      return {
        id: "fp-certerror-not-yet-valid-why-dangerous-body",
        args: { date: errorInfo.validNotBefore },
      };
    }

    return {
      id: "fp-certerror-expired-why-dangerous-body",
      args: { date: errorInfo.validNotAfter },
    };
  },
};

/**
 * Resolve the advanced section configuration.
 *
 * @param {object | null} advancedConfig - The advanced section config
 * @param {object} context - Runtime context
 * @returns {object | null} Resolved advanced config
 */
export function resolveAdvancedConfig(advancedConfig, context) {
  if (!advancedConfig) {
    return null;
  }

  const resolved = { ...advancedConfig };

  // Handle resolver for whyDangerous
  if (advancedConfig.whyDangerousResolver) {
    const resolver = ADVANCED_RESOLVERS[advancedConfig.whyDangerousResolver];
    if (resolver) {
      resolved.whyDangerous = resolver(context);
    }
    delete resolved.whyDangerousResolver;
  } else if (advancedConfig.whyDangerous) {
    resolved.whyDangerous = resolveL10nArgs(
      advancedConfig.whyDangerous,
      context
    );
  }

  if (advancedConfig.whatCanYouDo) {
    resolved.whatCanYouDo = resolveL10nArgs(
      advancedConfig.whatCanYouDo,
      context
    );
  }

  return resolved;
}

/**
 * Get a fully resolved error configuration with runtime context applied.
 *
 * @param {string} errorCode - The error code to look up
 * @param {object} context - Runtime context { hostname, errorInfo, noConnectivity, showOSXPermissionWarning }
 * @returns {object} Fully resolved error configuration
 */
export function getResolvedErrorConfig(errorCode, context) {
  const baseConfig = getErrorConfig(errorCode);

  return {
    ...baseConfig,
    introContent: resolveL10nArgs(baseConfig.introContent, context),
    shortDescription: resolveL10nArgs(baseConfig.shortDescription, context),
    descriptionParts: resolveDescriptionParts(
      baseConfig.descriptionParts,
      context
    ),
    advanced: resolveAdvancedConfig(baseConfig.advanced, context),
  };
}

// Export resolvers for testing
export const _testOnlyResolvers = {
  description: DESCRIPTION_RESOLVERS,
  advanced: ADVANCED_RESOLVERS,
};
