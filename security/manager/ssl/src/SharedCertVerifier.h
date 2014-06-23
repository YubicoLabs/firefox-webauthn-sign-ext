/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_psm__SharedCertVerifier_h
#define mozilla_psm__SharedCertVerifier_h

#include "certt.h"
#include "CertVerifier.h"
#include "mozilla/RefPtr.h"

namespace mozilla { namespace psm {

class SharedCertVerifier : public mozilla::psm::CertVerifier
{
protected:
  ~SharedCertVerifier();

public:
  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(SharedCertVerifier)

  SharedCertVerifier(ocsp_download_config odc, ocsp_strict_config osc,
                     ocsp_get_config ogc,
                     pinning_enforcement_config pinningEnforcementLevel)
    : mozilla::psm::CertVerifier(odc, osc, ogc, pinningEnforcementLevel)
  {
  }
};

} } // namespace mozilla::psm

#endif // mozilla_psm__SharedCertVerifier_h
