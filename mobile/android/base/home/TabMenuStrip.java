/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.home;

import org.mozilla.gecko.R;

import android.content.Context;
import android.content.res.TypedArray;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.accessibility.AccessibilityEvent;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * {@code TabMenuStrip} is the view used to display {@code HomePager} tabs
 * on tablets. See {@code TabMenuStripLayout} for details about how the
 * tabs are created and updated.
 */
public class TabMenuStrip extends HorizontalScrollView
                          implements HomePager.Decor {

    // Offset between the selected tab title and the edge of the screen,
    // except for the first and last tab in the tab strip.
    private static final int TITLE_OFFSET_DIPS = 24;

    private final int titleOffset;
    private final TabMenuStripLayout layout;

    public TabMenuStrip(Context context, AttributeSet attrs) {
        super(context, attrs);

        // Disable the scroll bar.
        setHorizontalScrollBarEnabled(false);

        titleOffset = (int) (TITLE_OFFSET_DIPS * getResources().getDisplayMetrics().density);

        layout = new TabMenuStripLayout(context, attrs);
        addView(layout, LayoutParams.FILL_PARENT, LayoutParams.FILL_PARENT);
    }

    @Override
    public void onAddPagerView(String title) {
        layout.onAddPagerView(title);
    }

    @Override
    public void removeAllPagerViews() {
        layout.removeAllViews();
    }

    @Override
    public void onPageSelected(final int position) {
        layout.onPageSelected(position);
    }

    @Override
    public void onPageScrolled(int position, float positionOffset, int positionOffsetPixels) {
        layout.onPageScrolled(position, positionOffset, positionOffsetPixels);

        final View selectedTitle = layout.getChildAt(position);
        if (selectedTitle == null) {
            return;
        }

        final int selectedTitleOffset = (int) (positionOffset * selectedTitle.getWidth());

        int titleLeft = selectedTitle.getLeft() + selectedTitleOffset;
        if (position > 0) {
            titleLeft -= titleOffset;
        }

        int titleRight = selectedTitle.getRight() + selectedTitleOffset;
        if (position < layout.getChildCount() - 1) {
            titleRight += titleOffset;
        }

        final int scrollX = getScrollX();
        if (titleLeft < scrollX) {
            // Tab strip overflows to the left.
            scrollTo(titleLeft, 0);
        } else if (titleRight > scrollX + getWidth()) {
            // Tab strip overflows to the right.
            scrollTo(titleRight - getWidth(), 0);
        }
    }

    @Override
    public void setOnTitleClickListener(HomePager.OnTitleClickListener onTitleClickListener) {
        layout.setOnTitleClickListener(onTitleClickListener);
    }
}
