/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Weave.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Dan Mills <thunder@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const EXPORTED_SYMBOLS = ['ClientRecord'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://weave/log4moz.js");
Cu.import("resource://weave/util.js");
Cu.import("resource://weave/base_records/wbo.js");

function ClientRecord(uri) {
  this._ClientRec_init(uri);
}
ClientRecord.prototype = {
  __proto__: WBORecord.prototype,
  _logName: "Record.Client",

  _ClientRec_init: function ClientRec_init(uri) {
    this._WBORec_init(uri);
  },

  deserialize: function ClientRecord_deserialize(json) {
    let data = JSON.parse(json, function(key, val) key == "payload" ?
      unescape(val) : val);
    WBORecord.prototype.deserialize.call(this, data);
  },

  toJSON: function toJSON() {
    let obj = WBORecord.prototype.toJSON.call(this);
    obj.payload = escape(obj.payload);
    return obj;
  },

  // engines.js uses cleartext to determine if records _isEqual
  // XXX Bug 482669 Implement .equals() for SyncEngine to compare records
  get cleartext() JSON.stringify(this),

  // XXX engines.js calls encrypt/decrypt for all records, so define these:
  encrypt: function ClientRecord_encrypt(passphrase) {},
  decrypt: function ClientRecord_decrypt(passphrase) {}
};
