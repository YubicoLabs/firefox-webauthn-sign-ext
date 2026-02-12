/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Network error configurations.
 * These include NS_ERROR_* codes and URL parameter error codes.
 */

export const HTTPS_UPGRADES_MDN_DOCS =
  "https://developer.mozilla.org/docs/Web/Security/HTTPS-Only_Mode";
export const COOP_MDN_DOCS =
  "https://developer.mozilla.org/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy";
export const COEP_MDN_DOCS =
  "https://developer.mozilla.org/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy";

export const NET_ERRORS = [
  {
    errorCode: "NS_ERROR_OFFLINE",
    category: "net",
    bodyTitleL10nId: "neterror-offline-body-title",
    introContent: {
      id: "fp-neterror-offline-intro",
      args: { hostname: null },
    },
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    customNetError: {
      titleL10nId: "fp-neterror-offline-body-title",
      whatCanYouDoL10nId: "fp-neterror-offline-what-can-you-do-body",
      whatCanYouDoL10nArgs: { hostname: null },
    },
    hasNoUserFix: false,
    image: "chrome://global/skin/illustrations/no-connection.svg",
  },
  {
    errorCode: "NS_ERROR_DOM_COOP_FAILED",
    category: "blocked",
    introContent: {
      id: "fp-neterror-coop-coep-intro",
    },
    buttons: {
      showTryAgain: false,
      showGoBack: true,
    },
    customNetError: {
      titleL10nId: "fp-certerror-body-title",
      whyDidThisHappenL10nId: "fp-neterror-coop-coep-why-did-this-happen-body",
      whyDidThisHappenL10nArgs: { hostname: null },
      learnMoreL10nId: "certerror-coop-learn-more",
      learnMoreSupportPage: COOP_MDN_DOCS,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "NS_ERROR_DOM_COEP_FAILED",
    category: "blocked",
    introContent: {
      id: "fp-neterror-coop-coep-intro",
    },
    buttons: {
      showTryAgain: false,
      showGoBack: true,
    },
    customNetError: {
      titleL10nId: "fp-certerror-body-title",
      whyDidThisHappenL10nId: "fp-neterror-coop-coep-why-did-this-happen-body",
      whyDidThisHappenL10nArgs: { hostname: null },
      learnMoreL10nId: "certerror-coep-learn-more",
      learnMoreSupportPage: COEP_MDN_DOCS,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "NS_ERROR_BASIC_HTTP_AUTH_DISABLED",
    category: "net",
    introContent: {
      id: "fp-neterror-http-auth-disabled-intro",
    },
    buttons: {
      showTryAgain: false,
      showGoBack: true,
      showAdvanced: true,
    },
    advanced: {
      whyDangerousL10nId: "fp-neterror-http-auth-disabled-why-dangerous-body",
      whyDangerousL10nArgs: { hostname: null },
      whatCanYouDoL10nId: "fp-neterror-http-auth-disabled-what-can-you-do-body",
      learnMoreL10nId: "fp-learn-more-about-https-connections",
      learnMoreSupportPage: HTTPS_UPGRADES_MDN_DOCS,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "NS_ERROR_NET_EMPTY_RESPONSE",
    category: "net",
    bodyTitleL10nId: "problem-with-this-site-title",
    introContent: {
      id: "neterror-http-empty-response-description",
      args: { hostname: null },
    },
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    customNetError: {
      titleL10nId: "problem-with-this-site-title",
      whatCanYouDoL10nId: "neterror-http-empty-response",
    },
    hasNoUserFix: false,
    image: "chrome://global/skin/illustrations/no-connection.svg",
  },
  // Legacy URL parameter error codes (used in aboutNetError.mjs)
  {
    errorCode: "connectionFailure",
    category: "net",
    descriptionParts: "connectionFailureDescription",
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "netInterrupt",
    category: "net",
    descriptionParts: "connectionFailureDescription",
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "netReset",
    category: "net",
    descriptionParts: "connectionFailureDescription",
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "netTimeout",
    category: "net",
    descriptionParts: "connectionFailureDescription",
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "dnsNotFound",
    category: "net",
    descriptionParts: "dnsNotFoundDescription",
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
    checkTrrOnly: true,
  },
  {
    errorCode: "blockedByPolicy",
    category: "blocked",
    descriptionParts: [],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "blockedByCOOP",
    category: "blocked",
    descriptionParts: [
      { tag: "p", l10nId: "certerror-blocked-by-corp-headers-description" },
      { tag: "a", l10nId: "certerror-coop-learn-more", href: COOP_MDN_DOCS },
    ],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "blockedByCOEP",
    category: "blocked",
    descriptionParts: [
      { tag: "p", l10nId: "certerror-blocked-by-corp-headers-description" },
      { tag: "a", l10nId: "certerror-coep-learn-more", href: COEP_MDN_DOCS },
    ],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "basicHttpAuthDisabled",
    category: "net",
    descriptionParts: [
      {
        tag: "li",
        l10nId: "neterror-basic-http-auth",
        l10nArgs: { hostname: null },
      },
      {
        tag: "a",
        l10nId: "neterror-learn-more-link",
        href: HTTPS_UPGRADES_MDN_DOCS,
      },
    ],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "httpErrorPage",
    category: "net",
    descriptionParts: [{ tag: "li", l10nId: "neterror-http-error-page" }],
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "serverError",
    category: "net",
    descriptionParts: [{ tag: "li", l10nId: "neterror-load-error-try-again" }],
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "invalidHeaderValue",
    category: "net",
    descriptionParts: [{ tag: "li", l10nId: "neterror-http-error-page" }],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "deniedPortAccess",
    category: "blocked",
    descriptionParts: [],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "malformedURI",
    category: "net",
    descriptionParts: [],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "captivePortal",
    category: "net",
    descriptionParts: [{ tag: "p", l10nId: "" }],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
      showOpenPortal: true,
    },
    hasNoUserFix: false,
    isCaptivePortal: true,
  },
  {
    errorCode: "contentEncodingError",
    category: "net",
    descriptionParts: [
      { tag: "li", l10nId: "neterror-content-encoding-error" },
    ],
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "corruptedContentErrorv2",
    category: "net",
    descriptionParts: [
      { tag: "p", l10nId: "neterror-corrupted-content-intro" },
      { tag: "li", l10nId: "neterror-corrupted-content-contact-website" },
    ],
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "fileAccessDenied",
    category: "net",
    descriptionParts: [{ tag: "li", l10nId: "neterror-access-denied" }],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "fileNotFound",
    category: "net",
    descriptionParts: [
      { tag: "li", l10nId: "neterror-file-not-found-filename" },
      { tag: "li", l10nId: "neterror-file-not-found-moved" },
    ],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "inadequateSecurityError",
    category: "net",
    descriptionParts: [
      {
        tag: "p",
        l10nId: "neterror-inadequate-security-intro",
        l10nArgs: { hostname: null },
      },
      { tag: "p", l10nId: "neterror-inadequate-security-code" },
    ],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "mitm",
    category: "cert",
    descriptionPartsResolver: "mitmDescription",
    buttons: {
      showTryAgain: false,
      showGoBack: true,
      showAdvanced: true,
    },
    hasNoUserFix: false,
    checkMitm: true,
  },
  {
    errorCode: "netOffline",
    category: "net",
    descriptionParts: [{ tag: "li", l10nId: "neterror-net-offline" }],
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "networkProtocolError",
    category: "net",
    descriptionParts: [
      { tag: "p", l10nId: "neterror-network-protocol-error-intro" },
      { tag: "li", l10nId: "neterror-network-protocol-error-contact-website" },
    ],
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "notCached",
    category: "net",
    descriptionParts: [
      { tag: "p", l10nId: "neterror-not-cached-intro" },
      { tag: "li", l10nId: "neterror-not-cached-sensitive" },
      { tag: "li", l10nId: "neterror-not-cached-try-again" },
    ],
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "nssFailure2",
    category: "cert",
    descriptionParts: [
      { tag: "li", l10nId: "neterror-nss-failure-not-verified" },
      { tag: "li", l10nId: "neterror-nss-failure-contact-website" },
    ],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
      showPrefReset: true,
    },
    hasNoUserFix: false,
    checkNSSFailure: true,
  },
  {
    errorCode: "proxyConnectFailure",
    category: "net",
    descriptionParts: [
      { tag: "li", l10nId: "neterror-proxy-connect-failure-settings" },
      { tag: "li", l10nId: "neterror-proxy-connect-failure-contact-admin" },
    ],
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "proxyResolveFailure",
    category: "net",
    descriptionParts: [
      { tag: "li", l10nId: "neterror-proxy-resolve-failure-settings" },
      { tag: "li", l10nId: "neterror-proxy-resolve-failure-connection" },
      { tag: "li", l10nId: "neterror-proxy-resolve-failure-firewall" },
    ],
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "redirectLoop",
    category: "net",
    descriptionParts: [{ tag: "li", l10nId: "neterror-redirect-loop" }],
    buttons: {
      showTryAgain: true,
      showGoBack: false,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "sslv3Used",
    category: "cert",
    descriptionParts: [{ tag: "span", l10nId: "neterror-sslv3-used" }],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "unknownProtocolFound",
    category: "net",
    descriptionParts: [{ tag: "li", l10nId: "neterror-unknown-protocol" }],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "unknownSocketType",
    category: "net",
    descriptionParts: [
      { tag: "li", l10nId: "neterror-unknown-socket-type-psm-installed" },
      { tag: "li", l10nId: "neterror-unknown-socket-type-server-config" },
    ],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "unsafeContentType",
    category: "net",
    descriptionParts: [{ tag: "li", l10nId: "neterror-unsafe-content-type" }],
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "cspBlocked",
    category: "blocked",
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "xfoBlocked",
    category: "blocked",
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
];
