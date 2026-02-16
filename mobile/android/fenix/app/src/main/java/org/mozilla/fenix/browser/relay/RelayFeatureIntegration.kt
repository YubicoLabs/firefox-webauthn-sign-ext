/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.fenix.browser.relay

import android.content.Context
import mozilla.components.concept.engine.Engine
import mozilla.components.service.fxa.manager.FxaAccountManager
import mozilla.components.service.fxrelay.eligibility.RelayEligibilityStore
import mozilla.components.service.fxrelay.eligibility.RelayFeature
import mozilla.components.support.base.feature.LifecycleAwareFeature
import org.mozilla.fenix.R
import org.mozilla.fenix.components.AppStore

/**
 * A wrapper class for features that relate to the Firefox Relay email masking service.
 */
class RelayFeatureIntegration(
    context: Context,
    private val engine: Engine,
    private val store: RelayEligibilityStore,
    private val appStore: AppStore,
    private val accountManager: FxaAccountManager,
    private val errorMessages: ErrorMessages = ErrorMessages(
        maxMasksReached = context.getString(R.string.email_masks_max_free_tier_reached),
        errorRetrievingMasks = context.getString(R.string.email_masks_error_retrieving_masks),
    ),
) : LifecycleAwareFeature {
    private val relayFeature by lazy {
        RelayFeature(
            accountManager = accountManager,
            store = store,
        )
    }
    private val emailMaskEngineUpdater by lazy {
        EmailMaskEngineUpdater(engine, store)
    }
    private val emailMaskInfoPrompter by lazy {
        EmailMaskInfoPrompter(store, appStore, errorMessages)
    }

    override fun start() {
        relayFeature.start()
        emailMaskEngineUpdater.start()
        emailMaskInfoPrompter.start()
    }

    override fun stop() {
        relayFeature.stop()
        emailMaskEngineUpdater.stop()
        emailMaskInfoPrompter.stop()
    }
}
