/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.fenix.components.toolbar.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import mozilla.components.compose.base.SelectableChip
import org.mozilla.fenix.browser.browsingmode.BrowsingMode
import org.mozilla.fenix.theme.FirefoxTheme
import org.mozilla.fenix.theme.PreviewThemeProvider
import org.mozilla.fenix.theme.Theme

/**
 * A selector to switch between Private and Standard browsing modes.
 *
 * @param selectedMode The currently selected [BrowsingMode].
 * @param onModeSelected Callback invoked when a new mode is selected.
 * @param modifier [Modifier] to be applied to the selector.
 */
@Composable
fun BrowserModeSelector(
    selectedMode: BrowsingMode,
    onModeSelected: (BrowsingMode) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .background(
                color = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(20.dp),
            )
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.outlineVariant,
                shape = RoundedCornerShape(20.dp),
            )
            .padding(horizontal = FirefoxTheme.layout.space.static100),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val chipColors = FilterChipDefaults.filterChipColors(
            containerColor = Color.Transparent,
            labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer,
        )

        SelectableChip(
            text = "Private",
            selected = selectedMode == BrowsingMode.Private,
            showIcon = false,
            colors = chipColors,
            border = null,
            onClick = { onModeSelected(BrowsingMode.Private) },
        )

        SelectableChip(
            text = "Standard",
            selected = selectedMode == BrowsingMode.Normal,
            showIcon = false,
            colors = chipColors,
            border = null,
            onClick = { onModeSelected(BrowsingMode.Normal) },
        )
    }
}

@Preview
@Composable
private fun BrowserModeSelectorPreview(
    @PreviewParameter(PreviewThemeProvider::class) theme: Theme,
) {
    FirefoxTheme(theme = theme) {
        BrowserModeSelector(
            selectedMode = BrowsingMode.Normal,
            onModeSelected = {},
            modifier = Modifier.padding(16.dp),
        )
    }
}
