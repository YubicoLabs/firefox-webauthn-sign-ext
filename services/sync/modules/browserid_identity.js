/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["BrowserIDManager"];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/Log.jsm");
Cu.import("resource://services-common/async.js");
Cu.import("resource://services-common/tokenserverclient.js");
Cu.import("resource://services-crypto/utils.js");
Cu.import("resource://services-sync/identity.js");
Cu.import("resource://services-sync/util.js");
Cu.import("resource://services-common/tokenserverclient.js");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://services-sync/constants.js");
Cu.import("resource://gre/modules/Promise.jsm");
Cu.import("resource://services-sync/stages/cluster.js");

// Lazy imports to prevent unnecessary load on startup.
XPCOMUtils.defineLazyModuleGetter(this, "BulkKeyBundle",
                                  "resource://services-sync/keys.js");

XPCOMUtils.defineLazyModuleGetter(this, "fxAccounts",
                                  "resource://gre/modules/FxAccounts.jsm");

XPCOMUtils.defineLazyGetter(this, 'fxAccountsCommon', function() {
  let ob = {};
  Cu.import("resource://gre/modules/FxAccountsCommon.js", ob);
  return ob;
});

function deriveKeyBundle(kB) {
  let out = CryptoUtils.hkdf(kB, undefined,
                             "identity.mozilla.com/picl/v1/oldsync", 2*32);
  let bundle = new BulkKeyBundle();
  // [encryptionKey, hmacKey]
  bundle.keyPair = [out.slice(0, 32), out.slice(32, 64)];
  return bundle;
}


this.BrowserIDManager = function BrowserIDManager() {
  this._fxaService = fxAccounts;
  this._tokenServerClient = new TokenServerClient();
  // will be a promise that resolves when we are ready to authenticate
  this.whenReadyToAuthenticate = null;
  this._log = Log.repository.getLogger("Sync.BrowserIDManager");
  this._log.Level = Log.Level[Svc.Prefs.get("log.logger.identity")];

};

this.BrowserIDManager.prototype = {
  __proto__: IdentityManager.prototype,

  _fxaService: null,
  _tokenServerClient: null,
  // https://docs.services.mozilla.com/token/apis.html
  _token: null,
  _account: null,

  // it takes some time to fetch a sync key bundle, so until this flag is set,
  // we don't consider the lack of a keybundle as a failure state.
  _shouldHaveSyncKeyBundle: false,

  get readyToAuthenticate() {
    // We are finished initializing when we *should* have a sync key bundle,
    // although we might not actually have one due to auth failures etc.
    return this._shouldHaveSyncKeyBundle;
  },

  initialize: function() {
    Services.obs.addObserver(this, fxAccountsCommon.ONVERIFIED_NOTIFICATION, false);
    Services.obs.addObserver(this, fxAccountsCommon.ONLOGOUT_NOTIFICATION, false);
    return this.initializeWithCurrentIdentity();
  },

  initializeWithCurrentIdentity: function() {
    this._log.trace("initializeWithCurrentIdentity");
    Components.utils.import("resource://services-sync/main.js");

    // Reset the world before we do anything async.
    this.whenReadyToAuthenticate = Promise.defer();
    this._shouldHaveSyncKeyBundle = false;
    this.username = ""; // this calls resetCredentials which drops the key bundle.

    return fxAccounts.getSignedInUser().then(accountData => {
      if (!accountData) {
        this._log.info("initializeWithCurrentIdentity has no user logged in");
        this._account = null;
        return;
      }
      this._account = accountData.email;
      // We start a background keybundle fetch...
      this._log.info("Starting background fetch for key bundle.");
      this._fetchSyncKeyBundle().then(() => {
        this._shouldHaveSyncKeyBundle = true; // and we should actually have one...
        this.whenReadyToAuthenticate.resolve();
        this._log.info("Background fetch for key bundle done");
      }).then(null, err => {
        this._shouldHaveSyncKeyBundle = true; // but we probably don't have one...
        this.whenReadyToAuthenticate.reject(err);
        // report what failed...
        this._log.error("Background fetch for key bundle failed: " + err);
        throw err;
      });
      // and we are done - the fetch continues on in the background...
    }).then(null, err => {
      dump("err in processing logged in account "+err.message);
    });
  },

  observe: function (subject, topic, data) {
    switch (topic) {
    case fxAccountsCommon.ONVERIFIED_NOTIFICATION:
    case fxAccountsCommon.ONLOGIN_NOTIFICATION:
      // For now, we just assume it's the same user logging back in.
      // Bug 958927 exists to work out what to do if that's not true.  It might
      // be that the :onlogout observer does a .startOver (or maybe not - TBD)
      // But for now, do nothing, and sync will just start re-synching in its
      // own sweet time...
      this.initializeWithCurrentIdentity();
      break;

    case fxAccountsCommon.ONLOGOUT_NOTIFICATION:
      Components.utils.import("resource://services-sync/main.js");
      // Setting .username calls resetCredentials which drops the key bundle
      // and resets _shouldHaveSyncKeyBundle.
      this.username = "";
      this._account = null;
      Weave.Service.logout();
      break;
    }
  },

  /**
   * Provide override point for testing token expiration.
   */
  _now: function() {
    return Date.now();
  },

  get account() {
    return this._account;
  },

  /**
   * Sets the active account name.
   *
   * This should almost always be called in favor of setting username, as
   * username is derived from account.
   *
   * Changing the account name has the side-effect of wiping out stored
   * credentials. Keep in mind that persistCredentials() will need to be called
   * to flush the changes to disk.
   *
   * Set this value to null to clear out identity information.
   */
  set account(value) {
    throw "account setter should be not used in BrowserIDManager";
  },

  /**
   * Obtains the HTTP Basic auth password.
   *
   * Returns a string if set or null if it is not set.
   */
  get basicPassword() {
    this._log.error("basicPassword getter should be not used in BrowserIDManager");
    return null;
  },

  /**
   * Set the HTTP basic password to use.
   *
   * Changes will not persist unless persistSyncCredentials() is called.
   */
  set basicPassword(value) {
    throw "basicPassword setter should be not used in BrowserIDManager";
  },

  /**
   * Obtain the Sync Key.
   *
   * This returns a 26 character "friendly" Base32 encoded string on success or
   * null if no Sync Key could be found.
   *
   * If the Sync Key hasn't been set in this session, this will look in the
   * password manager for the sync key.
   */
  get syncKey() {
    if (this.syncKeyBundle) {
      // TODO: This is probably fine because the code shouldn't be
      // using the sync key directly (it should use the sync key
      // bundle), but I don't like it. We should probably refactor
      // code that is inspecting this to not do validation on this
      // field directly and instead call a isSyncKeyValid() function
      // that we can override.
      return "99999999999999999999999999";
    }
    else {
      return null;
    }
  },

  set syncKey(value) {
    throw "syncKey setter should be not used in BrowserIDManager";
  },

  get syncKeyBundle() {
    return this._syncKeyBundle;
  },

  /**
   * Resets/Drops all credentials we hold for the current user.
   */
  resetCredentials: function() {
    // the only credentials we hold are the sync key.
    this.resetSyncKey();
  },

  /**
   * Resets/Drops the sync key we hold for the current user.
   */
  resetSyncKey: function() {
    this._syncKey = null;
    this._syncKeyBundle = null;
    this._syncKeyUpdated = true;
    this._shouldHaveSyncKeyBundle = false;
  },

  /**
   * The current state of the auth credentials.
   *
   * This essentially validates that enough credentials are available to use
   * Sync.
   */
  get currentAuthState() {
    // TODO: need to revisit this. Currently this isn't ready to go until
    // both the username and syncKeyBundle are both configured and having no
    // username seems to make things fail fast so that's good.
    if (!this.username) {
      return LOGIN_FAILED_NO_USERNAME;
    }

    // No need to check this.syncKey as our getter for that attribute
    // uses this.syncKeyBundle
    // If bundle creation started, but failed.
    if (this._shouldHaveSyncKeyBundle && !this.syncKeyBundle) {
      return LOGIN_FAILED_NO_PASSPHRASE;
    }

    return STATUS_OK;
  },

  /**
   * Do we have a non-null, not yet expired token whose email field
   * matches (when normalized) our account field?
   */
  hasValidToken: function() {
    if (!this._token) {
      return false;
    }
    if (this._token.expiration < this._now()) {
      return false;
    }
    let signedInUser = this._getSignedInUser();
    if (!signedInUser) {
      return false;
    }
    // Does the signed in user match the user we retrieved the token for?
    if (signedInUser.email !== this.account) {
      return false;
    }
    return true;
  },

  /**
   * Wrap and synchronize FxAccounts.getSignedInUser().
   *
   * @return credentials per wrapped.
   */
  _getSignedInUser: function() {
    let userData;
    let cb = Async.makeSpinningCallback();

    this._fxaService.getSignedInUser().then(function (result) {
        cb(null, result);
    },
    function (err) {
        cb(err);
    });

    try {
      userData = cb.wait();
    } catch (err) {
      this._log.error("FxAccounts.getSignedInUser() failed with: " + err);
      return null;
    }
    return userData;
  },

  _fetchSyncKeyBundle: function() {
    // Fetch a sync token for the logged in user from the token server.
    return this._refreshTokenForLoggedInUser(
    ).then(token => {
      this._token = token;
      return this._fxaService.getKeys();
    }).then(userData => {
      // unlikely, but if the logged in user somehow changed between these
      // calls we better fail.
      if (!userData || userData.email !== this.account) {
        throw new Error("The currently logged-in user has changed.");
      }
      // Set the username to be the uid returned by the token server.
      this.username = this._token.uid.toString();
      // both Jelly and FxAccounts give us kA/kB as hex.
      let kB = Utils.hexToBytes(userData.kB);
      this._syncKeyBundle = deriveKeyBundle(kB);
    });
  },

  // Refresh the sync token for the currently logged in Firefox Accounts user.
  // This method requires that this module has been intialized for a user.
  _refreshTokenForLoggedInUser: function() {
    return this._fxaService.getSignedInUser().then(function (userData) {
      if (!userData || userData.email !== this.account) {
        // This means the logged in user changed or the identity module
        // wasn't properly initialized. TODO: figure out what needs to
        // happen here.
        this._log.error("Currently logged in FxA user differs from what was locally noted. TODO: do proper error handling.");
        return null;
      }
      return this._fetchTokenForUser(userData);
    }.bind(this));
  },

  _refreshTokenForLoggedInUserSync: function() {
    let cb = Async.makeSpinningCallback();

    this._refreshTokenForLoggedInUser().then(function (token) {
      cb(null, token);
    },
    function (err) {
      cb(err);
    });

    try {
      return cb.wait();
    } catch (err) {
      this._log.info("refreshTokenForLoggedInUserSync: " + err.message);
      return null;
    }
  },

  // This is a helper to fetch a sync token for the given user data.
  _fetchTokenForUser: function(userData) {
    let tokenServerURI = Svc.Prefs.get("tokenServerURI");
    let log = this._log;
    let client = this._tokenServerClient;
    log.info("Fetching Sync token from: " + tokenServerURI);

    function getToken(tokenServerURI, assertion) {
      let deferred = Promise.defer();
      let cb = function (err, token) {
        if (err) {
          log.info("TokenServerClient.getTokenFromBrowserIDAssertion() failed with: " + err.message);
          return deferred.reject(err);
        } else {
          return deferred.resolve(token);
        }
      };
      client.getTokenFromBrowserIDAssertion(tokenServerURI, assertion, cb);
      return deferred.promise;
    }

    let audience = Services.io.newURI(tokenServerURI, null, null).prePath;
    // wait until the account email is verified and we know that
    // getAssertion() will return a real assertion (not null).
    return this._fxaService.whenVerified(userData)
      .then(() => this._fxaService.getAssertion(audience))
      .then(assertion => getToken(tokenServerURI, assertion))
      .then(token => {
        token.expiration = this._now() + (token.duration * 1000);
        return token;
      });
  },

  getResourceAuthenticator: function () {
    return this._getAuthenticationHeader.bind(this);
  },

  /**
   * Obtain a function to be used for adding auth to RESTRequest instances.
   */
  getRESTRequestAuthenticator: function() {
    return this._addAuthenticationHeader.bind(this);
  },

  /**
   * @return a Hawk HTTP Authorization Header, lightly wrapped, for the .uri
   * of a RESTRequest or AsyncResponse object.
   */
  _getAuthenticationHeader: function(httpObject, method) {
    if (!this.hasValidToken()) {
      // Refresh token for the currently logged in FxA user
      this._token = this._refreshTokenForLoggedInUserSync();
      if (!this._token) {
        return null;
      }
    }
    let credentials = {algorithm: "sha256",
                       id: this._token.id,
                       key: this._token.key,
                      };
    method = method || httpObject.method;
    let headerValue = CryptoUtils.computeHAWK(httpObject.uri, method,
                                              {credentials: credentials});
    return {headers: {authorization: headerValue.field}};
  },

  _addAuthenticationHeader: function(request, method) {
    let header = this._getAuthenticationHeader(request, method);
    if (!header) {
      return null;
    }
    request.setHeader("authorization", header.headers.authorization);
    return request;
  },

  createClusterManager: function(service) {
    return new BrowserIDClusterManager(service);
  }

};

/* An implementation of the ClusterManager for this identity
 */

function BrowserIDClusterManager(service) {
  ClusterManager.call(this, service);
}

BrowserIDClusterManager.prototype = {
  __proto__: ClusterManager.prototype,

  _findCluster: function() {
    let promiseClusterURL = function() {
      return fxAccounts.getSignedInUser().then(userData => {
        return this.identity._fetchTokenForUser(userData).then(token => {
          // Set the clusterURI for this user based on the endpoint in the
          // token. This is a bit of a hack, and we should figure out a better
          // way of distributing it to components that need it.
          let clusterURI = Services.io.newURI(token.endpoint, null, null);
          clusterURI.path = "/";
          return clusterURI.spec;
        });
      });
    }.bind(this);

    let cb = Async.makeSpinningCallback();
    promiseClusterURL().then(function (clusterURL) {
        cb(null, clusterURL);
    },
    function (err) {
        cb(err);
    });
    return cb.wait();
  },
}
