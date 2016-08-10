/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use app_units::Au;
use euclid::point::Point2D;
use euclid::rect::Rect;
use gfx_traits::LayerId;
use script_traits::UntrustedNodeAddress;
use style::properties::longhands::{margin_top, margin_right, margin_bottom, margin_left, overflow_x};

/// Synchronous messages that script can send to layout.
///
/// In general, you should use messages to talk to Layout. Use the RPC interface
/// if and only if the work is
///
///   1) read-only with respect to LayoutThreadData,
///   2) small,
///   3) and really needs to be fast.
pub trait LayoutRPC {
    /// Requests the dimensions of the content box, as in the `getBoundingClientRect()` call.
    fn content_box(&self) -> ContentBoxResponse;
    /// Requests the dimensions of all the content boxes, as in the `getClientRects()` call.
    fn content_boxes(&self) -> ContentBoxesResponse;
    /// Requests the geometry of this node. Used by APIs such as `clientTop`.
    fn node_geometry(&self) -> NodeGeometryResponse;
    /// Requests the overflow-x and overflow-y of this node. Used by `scrollTop` etc.
    fn node_overflow(&self) -> NodeOverflowResponse;
    /// Requests the scroll geometry of this node. Used by APIs such as `scrollTop`.
    fn node_scroll_area(&self) -> NodeGeometryResponse;
    /// Requests the layer id of this node. Used by APIs such as `scrollTop`
    fn node_layer_id(&self) -> NodeLayerIdResponse;
    /// Requests the node containing the point of interest
    fn hit_test(&self) -> HitTestResponse;
    /// Query layout for the resolved value of a given CSS property
    fn resolved_style(&self) -> ResolvedStyleResponse;
    fn offset_parent(&self) -> OffsetParentResponse;
    /// Query layout for the resolve values of the margin properties for an element.
    fn margin_style(&self) -> MarginStyleResponse;

    fn nodes_from_point(&self, page_point: Point2D<f32>, client_point: Point2D<f32>) -> Vec<UntrustedNodeAddress>;
}

pub struct ContentBoxResponse(pub Rect<Au>);

pub struct ContentBoxesResponse(pub Vec<Rect<Au>>);

pub struct NodeGeometryResponse {
    pub client_rect: Rect<i32>,
}

pub struct NodeOverflowResponse(pub Option<Point2D<overflow_x::computed_value::T>>);

pub struct NodeLayerIdResponse {
    pub layer_id: LayerId,
}

pub struct HitTestResponse {
    pub node_address: Option<UntrustedNodeAddress>,
}

pub struct ResolvedStyleResponse(pub Option<String>);

#[derive(Clone)]
pub struct OffsetParentResponse {
    pub node_address: Option<UntrustedNodeAddress>,
    pub rect: Rect<Au>,
}

impl OffsetParentResponse {
    pub fn empty() -> OffsetParentResponse {
        OffsetParentResponse {
            node_address: None,
            rect: Rect::zero(),
        }
    }
}

#[derive(Clone)]
pub struct MarginStyleResponse {
    pub top: margin_top::computed_value::T,
    pub right: margin_right::computed_value::T,
    pub bottom: margin_bottom::computed_value::T,
    pub left: margin_left::computed_value::T,
}

impl MarginStyleResponse {
    pub fn empty() -> MarginStyleResponse {
        MarginStyleResponse {
            top: margin_top::computed_value::T::Auto,
            right: margin_right::computed_value::T::Auto,
            bottom: margin_bottom::computed_value::T::Auto,
            left: margin_left::computed_value::T::Auto,
        }
    }
}
