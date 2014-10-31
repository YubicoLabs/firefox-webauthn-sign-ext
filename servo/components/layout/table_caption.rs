/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//! CSS table formatting contexts.

#![deny(unsafe_block)]

use block::BlockFlow;
use construct::FlowConstructor;
use context::LayoutContext;
use flow::{TableCaptionFlowClass, FlowClass, Flow};
use wrapper::ThreadSafeLayoutNode;

use servo_util::geometry::Au;
use std::fmt;
use style::ComputedValues;
use sync::Arc;

/// A table formatting context.
pub struct TableCaptionFlow {
    pub block_flow: BlockFlow,
}

impl TableCaptionFlow {
    pub fn from_node(constructor: &mut FlowConstructor,
                     node: &ThreadSafeLayoutNode)
                     -> TableCaptionFlow {
        TableCaptionFlow {
            block_flow: BlockFlow::from_node(constructor, node)
        }
    }
}

impl Flow for TableCaptionFlow {
    fn class(&self) -> FlowClass {
        TableCaptionFlowClass
    }

    fn as_table_caption<'a>(&'a mut self) -> &'a mut TableCaptionFlow {
        self
    }

    fn as_block<'a>(&'a mut self) -> &'a mut BlockFlow {
        &mut self.block_flow
    }

    fn bubble_inline_sizes(&mut self) {
        self.block_flow.bubble_inline_sizes();
    }

    fn assign_inline_sizes(&mut self, ctx: &LayoutContext) {
        debug!("assign_inline_sizes({}): assigning inline_size for flow", "table_caption");
        self.block_flow.assign_inline_sizes(ctx);
    }

    fn assign_block_size<'a>(&mut self, ctx: &'a LayoutContext<'a>) {
        debug!("assign_block_size: assigning block_size for table_caption");
        self.block_flow.assign_block_size(ctx);
    }

    fn compute_absolute_position(&mut self) {
        self.block_flow.compute_absolute_position()
    }

    fn update_late_computed_inline_position_if_necessary(&mut self, inline_position: Au) {
        self.block_flow.update_late_computed_inline_position_if_necessary(inline_position)
    }

    fn update_late_computed_block_position_if_necessary(&mut self, block_position: Au) {
        self.block_flow.update_late_computed_block_position_if_necessary(block_position)
    }

    fn build_display_list(&mut self, layout_context: &LayoutContext) {
        debug!("build_display_list_table_caption: same process as block flow");
        self.block_flow.build_display_list(layout_context)
    }

    fn repair_style(&mut self, new_style: &Arc<ComputedValues>) {
        self.block_flow.repair_style(new_style)
    }
}

impl fmt::Show for TableCaptionFlow {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "TableCaptionFlow: {}", self.block_flow)
    }
}
