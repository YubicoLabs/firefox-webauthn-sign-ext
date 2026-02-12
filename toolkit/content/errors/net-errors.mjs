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
    pageTitleL10nId: "neterror-page-title",
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
  },
  {
    errorCode: "NS_ERROR_DOM_COOP_FAILED",
    category: "blocked",
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "general-body-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "general-body-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "general-body-title",
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
    pageTitleL10nId: "neterror-page-title",
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
  },
  // Legacy URL parameter error codes (used in aboutNetError.mjs)
  {
    errorCode: "connectionFailure",
    category: "net",
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "connectionFailure-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "netInterrupt-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "netReset-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "netTimeout-title",
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
    pageTitleL10nId: "neterror-dns-not-found-title",
    bodyTitleL10nId: "dnsNotFound-title",
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
    pageTitleL10nId: "neterror-blocked-by-policy-page-title",
    bodyTitleL10nId: "blockedByPolicy-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "general-body-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "general-body-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "general-body-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "httpErrorPage-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "serverError-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "problem-with-this-site-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "deniedPortAccess-title",
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
    pageTitleL10nId: "neterror-malformed-uri-page-title",
    bodyTitleL10nId: "malformedURI-title",
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
    pageTitleL10nId: "neterror-captive-portal-page-title",
    bodyTitleL10nId: "captivePortal-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "contentEncodingError-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "corruptedContentErrorv2-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "fileAccessDenied-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "fileNotFound-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "inadequateSecurityError-title",
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
    pageTitleL10nId: "certerror-page-title",
    bodyTitleL10nId: "nssBadCert-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "netOffline-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "networkProtocolError-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "notCached-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "nssFailure2-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "proxyConnectFailure-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "proxyResolveFailure-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "redirectLoop-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "sslv3Used-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "unknownProtocolFound-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "unknownSocketType-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "unsafeContentType-title",
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
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "csp-xfo-error-title",
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "xfoBlocked",
    category: "blocked",
    pageTitleL10nId: "neterror-page-title",
    bodyTitleL10nId: "csp-xfo-error-title",
    buttons: {
      showTryAgain: false,
      showGoBack: false,
    },
    hasNoUserFix: true,
  },
];
