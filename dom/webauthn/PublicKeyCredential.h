/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_dom_PublicKeyCredential_h
#define mozilla_dom_PublicKeyCredential_h

#include "js/TypeDecls.h"
#include "mozilla/Attributes.h"
#include "mozilla/dom/AuthenticatorAssertionResponse.h"
#include "mozilla/dom/AuthenticatorAttestationResponse.h"
#include "mozilla/dom/BindingDeclarations.h"
#include "mozilla/dom/Credential.h"
#include "nsCycleCollectionParticipant.h"
#include "nsWrapperCache.h"

namespace mozilla::dom {

class PublicKeyCredential final : public Credential {
 public:
  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_CYCLE_COLLECTION_SCRIPT_HOLDER_CLASS_INHERITED(PublicKeyCredential,
                                                         Credential)

  explicit PublicKeyCredential(nsPIDOMWindowInner* aParent);

 protected:
  ~PublicKeyCredential() override;

 public:
  virtual JSObject* WrapObject(JSContext* aCx,
                               JS::Handle<JSObject*> aGivenProto) override;

  void GetRawId(JSContext* aCx, JS::MutableHandle<JSObject*> aValue,
                ErrorResult& aRv);

  void GetAuthenticatorAttachment(DOMString& aAuthenticatorAttachment);

  already_AddRefed<AuthenticatorResponse> Response() const;

  void SetRawId(const nsTArray<uint8_t>& aBuffer);

  void SetAuthenticatorAttachment(
      const Maybe<nsString>& aAuthenticatorAttachment);

  void SetAttestationResponse(
      const RefPtr<AuthenticatorAttestationResponse>& aAttestationResponse);
  void SetAssertionResponse(
      const RefPtr<AuthenticatorAssertionResponse>& aAssertionResponse);

  static already_AddRefed<Promise>
  IsUserVerifyingPlatformAuthenticatorAvailable(GlobalObject& aGlobal,
                                                ErrorResult& aError);

  static already_AddRefed<Promise> IsConditionalMediationAvailable(
      GlobalObject& aGlobal, ErrorResult& aError);

  void GetClientExtensionResults(JSContext* cx,
                                 AuthenticationExtensionsClientOutputs& aResult);

  void ToJSON(JSContext* aCx, JS::MutableHandle<JSObject*> aRetval,
              ErrorResult& aError);

  void SetClientExtensionResultAppId(bool aResult);

  void SetClientExtensionResultCredPropsRk(bool aResult);

  void SetClientExtensionResultHmacCreateSecret(bool aHmacCreateSecret);
  void SetClientExtensionResultPrfEnabled(bool aPrfEnabled);
  void SetClientExtensionResultPrfResultsFirst(const nsTArray<uint8_t>& aPrfResultsFirst);
  void SetClientExtensionResultPrfResultsSecond(const nsTArray<uint8_t>& aPrfResultsSecond);
  void SetClientExtensionResultSignGeneratedKeyPublicKey(const nsTArray<uint8_t>& aSignGeneratedKeyPublicKey);
  void SetClientExtensionResultSignGeneratedKeyKeyHandle(const nsTArray<uint8_t>& aSignGeneratedKeyKeyHandle);
  void SetClientExtensionResultSignSignature(const nsTArray<uint8_t>& aSignSignature);

  static void ParseCreationOptionsFromJSON(
      GlobalObject& aGlobal,
      const PublicKeyCredentialCreationOptionsJSON& aOptions,
      PublicKeyCredentialCreationOptions& aResult, ErrorResult& aRv);

  static void ParseRequestOptionsFromJSON(
      GlobalObject& aGlobal,
      const PublicKeyCredentialRequestOptionsJSON& aOptions,
      PublicKeyCredentialRequestOptions& aResult, ErrorResult& aRv);

 private:
  nsTArray<uint8_t> mRawId;
  JS::Heap<JSObject*> mRawIdCachedObj;
  Maybe<nsString> mAuthenticatorAttachment;
  RefPtr<AuthenticatorAttestationResponse> mAttestationResponse;
  RefPtr<AuthenticatorAssertionResponse> mAssertionResponse;
  AuthenticationExtensionsClientOutputs mClientExtensionOutputs;
  Maybe<nsTArray<uint8_t>> mPrfResultsFirst;
  Maybe<nsTArray<uint8_t>> mPrfResultsSecond;
  Maybe<nsTArray<uint8_t>> mSignGeneratedKeyPublicKey;
  Maybe<nsTArray<uint8_t>> mSignGeneratedKeyKeyHandle;
  Maybe<nsTArray<uint8_t>> mSignSignature;
};

}  // namespace mozilla::dom

#endif  // mozilla_dom_PublicKeyCredential_h
