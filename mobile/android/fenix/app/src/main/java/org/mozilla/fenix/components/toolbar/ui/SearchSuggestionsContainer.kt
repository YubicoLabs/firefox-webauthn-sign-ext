/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.fenix.components.toolbar.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import org.mozilla.fenix.browser.browsingmode.BrowsingMode
import org.mozilla.fenix.theme.FirefoxTheme
import org.mozilla.fenix.theme.PreviewThemeProvider
import org.mozilla.fenix.theme.Theme

/**
 * Container for search suggestions content, optionally displaying a [BrowserModeSelector] at the
 * bottom.
 *
 * @param selectedMode The currently selected [BrowsingMode].
 * @param showBrowserModeToggle Whether to display the [BrowserModeSelector].
 * @param onModeSelected Callback invoked when a new browsing mode is selected via the selector.
 * @param searchSuggestionsContent The composable content for search suggestions, receiving a [Modifier]
 * to fill the available space.
 * @param modifier [Modifier] to be applied to the container.
 * @param browserModeSelectorModifier [Modifier] to be applied to the [BrowserModeSelector].
 */
@Composable
internal fun ColumnScope.SearchSuggestionsContainer(
    selectedMode: BrowsingMode,
    showBrowserModeToggle: Boolean,
    onModeSelected: (BrowsingMode) -> Unit,
    searchSuggestionsContent: @Composable (Modifier) -> Unit,
    modifier: Modifier = Modifier,
    browserModeSelectorModifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .weight(1f),
    ) {
        searchSuggestionsContent(Modifier.fillMaxSize())

        if (showBrowserModeToggle) {
            BrowserModeSelector(
                selectedMode = selectedMode,
                onModeSelected = onModeSelected,
                modifier = browserModeSelectorModifier.align(Alignment.BottomCenter),
            )
        }
    }
}

@Preview
@Composable
private fun SearchSuggestionsContainerPreview(
    @PreviewParameter(PreviewThemeProvider::class) theme: Theme,
) {
    FirefoxTheme(theme) {
        Column(modifier = Modifier.fillMaxSize()) {
            SearchSuggestionsContainer(
                selectedMode = BrowsingMode.Normal,
                showBrowserModeToggle = true,
                onModeSelected = {},
                searchSuggestionsContent = {
                    Surface(modifier = Modifier.fillMaxSize()) {
                        Text(text = "Search Suggestions Content")
                    }
                },
                browserModeSelectorModifier = Modifier.padding(bottom = 16.dp),
            )
        }
    }
}
