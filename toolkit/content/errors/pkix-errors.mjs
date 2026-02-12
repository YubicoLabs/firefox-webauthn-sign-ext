/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Mozilla PKIX error configurations (MOZILLA_PKIX_ERROR_* codes).
 * These errors relate to PKI validation issues.
 */

export const PKIX_ERRORS = [
  {
    errorCode: "MOZILLA_PKIX_ERROR_SELF_SIGNED_CERT",
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
      whyDangerousL10nId: "fp-certerror-self-signed-why-dangerous-body",
      whatCanYouDoL10nId: "fp-certerror-self-signed-what-can-you-do-body",
      importantNote: "fp-certerror-self-signed-important-note",
      showViewCertificate: true,
      showDateTime: true,
    },
    hasNoUserFix: false,
  },
  {
    errorCode: "MOZILLA_PKIX_ERROR_INSUFFICIENT_CERTIFICATE_TRANSPARENCY",
    category: "cert",
    pageTitleL10nId: "certerror-page-title",
    bodyTitleL10nId: "nssBadCert-title",
    introContent: {
      id: "fp-certerror-transparency-intro",
      args: { hostname: null },
    },
    buttons: {
      showTryAgain: false,
      showGoBack: true,
      showAdvanced: true,
      showAddException: false,
    },
    advanced: {
      whyDangerousL10nId: "fp-certerror-transparency-why-dangerous-body",
      whyDangerousL10nArgs: { hostname: null },
      whatCanYouDoL10nId: "fp-certerror-transparency-what-can-you-do-body",
      learnMoreL10nId: "fp-learn-more-about-secure-connection-failures",
      learnMoreSupportPage: "connection-not-secure",
      showViewCertificate: true,
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "MOZILLA_PKIX_ERROR_NOT_YET_VALID_CERTIFICATE",
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
      whyDangerousL10nId: "fp-certerror-pkix-not-yet-valid-why-dangerous-body",
      whyDangerousL10nArgs: { date: null },
      whatCanYouDoL10nId:
        "fp-certerror-pkix-not-yet-valid-what-can-you-do-body",
      whatCanYouDoL10nArgs: { date: null },
      learnMoreL10nId: "fp-learn-more-about-time-related-errors",
      learnMoreSupportPage: "time-errors",
      showViewCertificate: true,
    },
    hasNoUserFix: false,
  },
  // NSS/PKIX errors with no user fix
  {
    errorCode: "MOZILLA_PKIX_ERROR_INVALID_INTEGER_ENCODING",
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
      showAddException: false,
    },
    advanced: {
      titleL10nId: "fp-certerror-body-title",
      whyDangerousL10nId: "mozilla-pkix-error-invalid-integer-encoding",
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "MOZILLA_PKIX_ERROR_ISSUER_NO_LONGER_TRUSTED",
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
      showAddException: false,
    },
    advanced: {
      titleL10nId: "fp-certerror-body-title",
      whyDangerousL10nId: "mozilla-pkix-error-issuer-no-longer-trusted",
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "MOZILLA_PKIX_ERROR_KEY_PINNING_FAILURE",
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
      showAddException: false,
    },
    advanced: {
      titleL10nId: "fp-certerror-body-title",
      whyDangerousL10nId: "mozilla-pkix-error-key-pinning-failure",
    },
    hasNoUserFix: true,
  },
  {
    errorCode: "MOZILLA_PKIX_ERROR_SIGNATURE_ALGORITHM_MISMATCH",
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
      showAddException: false,
    },
    advanced: {
      titleL10nId: "fp-certerror-body-title",
      whyDangerousL10nId: "mozilla-pkix-error-signature-algorithm-mismatch",
    },
    hasNoUserFix: true,
  },
];
