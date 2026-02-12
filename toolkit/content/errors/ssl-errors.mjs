/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * SSL/TLS error configurations (SSL_ERROR_* codes).
 * These errors relate to TLS handshake and protocol issues.
 */

export const SSL_ERRORS = [
  {
    errorCode: "SSL_ERROR_BAD_CERT_DOMAIN",
    category: "cert",
    pageTitleL10nId: "certerror-page-title",
    bodyTitleL10nId: "nssBadCert-title",
    introContent: {
      id: "fp-certerror-intro",
      args: { hostname: null },
    },
    buttons: {
      showTryAgain: false,
      showGoBack: true,
      showAdvanced: true,
      showAddException: true,
    },
    advanced: {
      whyDangerousL10nId: "fp-certerror-bad-domain-why-dangerous-body",
      whyDangerousL10nArgs: { hostname: null, validHosts: null },
      whatCanYouDoL10nId: "fp-certerror-bad-domain-what-can-you-do-body",
      learnMoreL10nId: "fp-learn-more-about-secure-connection-failures",
      learnMoreSupportPage: "connection-not-secure",
      showViewCertificate: true,
      showDateTime: true,
      requiresDomainMismatchNames: true,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "SSL_ERROR_NO_CYPHER_OVERLAP",
    category: "cert",
    pageTitleL10nId: "certerror-page-title",
    bodyTitleL10nId: "nssBadCert-title",
    introContent: {
      id: "fp-neterror-connection-intro",
      args: { hostname: null },
    },
    buttons: {
      showTryAgain: false,
      showGoBack: true,
      showAdvanced: true,
      showAddException: false,
      showPrefReset: true,
    },
    advanced: {
      whyDangerousL10nId: "fp-neterror-cypher-overlap-why-dangerous-body",
      whatCanYouDoL10nId: "fp-neterror-cypher-overlap-what-can-you-do-body",
      learnMoreL10nId: "fp-learn-more-about-secure-connection-failures",
      learnMoreSupportPage: "connection-not-secure",
    },
    hasNoUserFix: false,
    checkNSSFailure: true,
  },
  {
    errorCode: "SSL_ERROR_RX_MALFORMED_HANDSHAKE",
    category: "cert",
    pageTitleL10nId: "nssFailure2-title",
    bodyTitleL10nId: "nssFailure2-title",
    introContent: {
      id: "fp-neterror-connection-intro",
      args: { hostname: null },
    },
    buttons: {
      showTryAgain: true,
      showGoBack: true,
      showAdvanced: true,
      showAddException: false,
    },
    advanced: {
      whyDangerousL10nId: "ssl-error-rx-malformed-handshake",
      learnMoreSupportPage: "connection-not-secure",
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "SSL_ERROR_UNSUPPORTED_VERSION",
    category: "cert",
    pageTitleL10nId: "nssFailure2-title",
    bodyTitleL10nId: "nssFailure2-title",
    introContent: {
      id: "fp-neterror-connection-intro",
      args: { hostname: null },
    },
    buttons: {
      showTryAgain: true,
      showGoBack: true,
      showAdvanced: true,
      showAddException: false,
    },
    advanced: {
      whyDangerousL10nId: "ssl-error-unsupported-version",
      learnMoreSupportPage: "connection-not-secure",
    },
    hasNoUserFix: true,
  },
];
