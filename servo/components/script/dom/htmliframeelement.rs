/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use dom::attr::Attr;
use dom::attr::AttrValue;
use dom::attr::AttrHelpers;
use dom::bindings::codegen::Bindings::HTMLIFrameElementBinding;
use dom::bindings::codegen::Bindings::HTMLIFrameElementBinding::HTMLIFrameElementMethods;
use dom::bindings::codegen::Bindings::WindowBinding::WindowMethods;
use dom::bindings::codegen::InheritTypes::{NodeCast, ElementCast, EventCast};
use dom::bindings::codegen::InheritTypes::{EventTargetCast, HTMLElementCast, HTMLIFrameElementDerived};
use dom::bindings::conversions::ToJSValConvertible;
use dom::bindings::error::{ErrorResult, Fallible};
use dom::bindings::error::Error::NotSupported;
use dom::bindings::global::GlobalRef;
use dom::bindings::js::{JSRef, Temporary, OptionalRootable};
use dom::customevent::CustomEvent;
use dom::document::Document;
use dom::element::Element;
use dom::element::AttributeHandlers;
use dom::event::{Event, EventBubbles, EventCancelable, EventHelpers};
use dom::eventtarget::{EventTarget, EventTargetTypeId};
use dom::element::ElementTypeId;
use dom::htmlelement::{HTMLElement, HTMLElementTypeId};
use dom::node::{Node, NodeHelpers, NodeTypeId, window_from_node};
use dom::urlhelper::UrlHelper;
use dom::virtualmethods::VirtualMethods;
use dom::window::{Window, WindowHelpers};
use page::IterablePage;

use msg::constellation_msg::{PipelineId, SubpageId, ConstellationChan, NavigationDirection};
use msg::constellation_msg::IFrameSandboxState::{IFrameSandboxed, IFrameUnsandboxed};
use msg::constellation_msg::Msg as ConstellationMsg;
use util::opts;
use util::str::DOMString;
use string_cache::Atom;

use std::ascii::AsciiExt;
use std::borrow::ToOwned;
use std::cell::Cell;
use url::{Url, UrlParser};

enum SandboxAllowance {
    AllowNothing = 0x00,
    AllowSameOrigin = 0x01,
    AllowTopNavigation = 0x02,
    AllowForms = 0x04,
    AllowScripts = 0x08,
    AllowPointerLock = 0x10,
    AllowPopups = 0x20
}

#[dom_struct]
pub struct HTMLIFrameElement {
    htmlelement: HTMLElement,
    subpage_id: Cell<Option<SubpageId>>,
    containing_page_pipeline_id: Cell<Option<PipelineId>>,
    sandbox: Cell<Option<u8>>,
}

impl HTMLIFrameElementDerived for EventTarget {
    fn is_htmliframeelement(&self) -> bool {
        *self.type_id() == EventTargetTypeId::Node(NodeTypeId::Element(ElementTypeId::HTMLElement(HTMLElementTypeId::HTMLIFrameElement)))
    }
}

pub trait HTMLIFrameElementHelpers {
    fn is_sandboxed(self) -> bool;
    fn get_url(self) -> Option<Url>;
    /// http://www.whatwg.org/html/#process-the-iframe-attributes
    fn process_the_iframe_attributes(self);
    fn generate_new_subpage_id(self) -> (SubpageId, Option<SubpageId>);
    fn navigate_child_browsing_context(self, url: Url);
    fn dispatch_mozbrowser_event(self, event_name: String, event_detail: Option<String>);
}

impl<'a> HTMLIFrameElementHelpers for JSRef<'a, HTMLIFrameElement> {
    fn is_sandboxed(self) -> bool {
        self.sandbox.get().is_some()
    }

    fn get_url(self) -> Option<Url> {
        let element: JSRef<Element> = ElementCast::from_ref(self);
        element.get_attribute(ns!(""), &atom!("src")).root().and_then(|src| {
            let url = src.r().value();
            if url.as_slice().is_empty() {
                None
            } else {
                let window = window_from_node(self).root();
                UrlParser::new().base_url(&window.r().get_url())
                    .parse(url.as_slice()).ok()
            }
        })
    }

    fn generate_new_subpage_id(self) -> (SubpageId, Option<SubpageId>) {
        let old_subpage_id = self.subpage_id.get();
        let win = window_from_node(self).root();
        let subpage_id = win.r().get_next_subpage_id();
        self.subpage_id.set(Some(subpage_id));
        (subpage_id, old_subpage_id)
    }

    fn navigate_child_browsing_context(self, url: Url) {
        let sandboxed = if self.is_sandboxed() {
            IFrameSandboxed
        } else {
            IFrameUnsandboxed
        };

        let window = window_from_node(self).root();
        let window = window.r();
        let (new_subpage_id, old_subpage_id) = self.generate_new_subpage_id();

        self.containing_page_pipeline_id.set(Some(window.pipeline()));

        let ConstellationChan(ref chan) = window.constellation_chan();
        chan.send(ConstellationMsg::ScriptLoadedURLInIFrame(url,
                                                            window.pipeline(),
                                                            new_subpage_id,
                                                            old_subpage_id,
                                                            sandboxed)).unwrap();

        if opts::experimental_enabled() {
            // https://developer.mozilla.org/en-US/docs/Web/Events/mozbrowserloadstart
            self.dispatch_mozbrowser_event("mozbrowserloadstart".to_owned(), None);
        }
    }

    fn process_the_iframe_attributes(self) {
        let url = match self.get_url() {
            Some(url) => url.clone(),
            None => Url::parse("about:blank").unwrap(),
        };

        self.navigate_child_browsing_context(url);
    }

    fn dispatch_mozbrowser_event(self, event_name: String, event_detail: Option<String>) {
        // TODO(gw): Support mozbrowser event types that have detail which is not a string.
        // See https://developer.mozilla.org/en-US/docs/Web/API/Using_the_Browser_API
        // for a list of mozbrowser events.
        assert!(opts::experimental_enabled());

        if self.Mozbrowser() {
            let window = window_from_node(self).root();
            let cx = window.r().get_cx();
            let custom_event = CustomEvent::new(GlobalRef::Window(window.r()),
                                                event_name.to_owned(),
                                                true,
                                                true,
                                                event_detail.to_jsval(cx)).root();
            let target: JSRef<EventTarget> = EventTargetCast::from_ref(self);
            let event: JSRef<Event> = EventCast::from_ref(custom_event.r());
            event.fire(target);
        }
    }
}

impl HTMLIFrameElement {
    fn new_inherited(localName: DOMString, prefix: Option<DOMString>, document: JSRef<Document>) -> HTMLIFrameElement {
        HTMLIFrameElement {
            htmlelement: HTMLElement::new_inherited(HTMLElementTypeId::HTMLIFrameElement, localName, prefix, document),
            subpage_id: Cell::new(None),
            containing_page_pipeline_id: Cell::new(None),
            sandbox: Cell::new(None),
        }
    }

    #[allow(unrooted_must_root)]
    pub fn new(localName: DOMString, prefix: Option<DOMString>, document: JSRef<Document>) -> Temporary<HTMLIFrameElement> {
        let element = HTMLIFrameElement::new_inherited(localName, prefix, document);
        Node::reflect_node(box element, document, HTMLIFrameElementBinding::Wrap)
    }

    #[inline]
    pub fn containing_page_pipeline_id(&self) -> Option<PipelineId> {
        self.containing_page_pipeline_id.get()
    }

    #[inline]
    pub fn subpage_id(&self) -> Option<SubpageId> {
        self.subpage_id.get()
    }
}

impl<'a> HTMLIFrameElementMethods for JSRef<'a, HTMLIFrameElement> {
    fn Src(self) -> DOMString {
        let element: JSRef<Element> = ElementCast::from_ref(self);
        element.get_string_attribute(&atom!("src"))
    }

    fn SetSrc(self, src: DOMString) {
        let element: JSRef<Element> = ElementCast::from_ref(self);
        element.set_url_attribute(&atom!("src"), src)
    }

    fn Sandbox(self) -> DOMString {
        let element: JSRef<Element> = ElementCast::from_ref(self);
        element.get_string_attribute(&atom!("sandbox"))
    }

    fn SetSandbox(self, sandbox: DOMString) {
        let element: JSRef<Element> = ElementCast::from_ref(self);
        element.set_tokenlist_attribute(&atom!("sandbox"), sandbox);
    }

    fn GetContentWindow(self) -> Option<Temporary<Window>> {
        self.subpage_id.get().and_then(|subpage_id| {
            let window = window_from_node(self).root();
            let window = window.r();
            let children = window.page().children.borrow();
            children.iter().find(|page| {
                let window = page.window().root();
                window.r().subpage() == Some(subpage_id)
            }).map(|page| page.window())
        })
    }

    fn GetContentDocument(self) -> Option<Temporary<Document>> {
        self.GetContentWindow().root().and_then(|window| {
            let self_url = match self.get_url() {
                Some(self_url) => self_url,
                None => return None,
            };
            let win_url = window_from_node(self).root().r().get_url();

            if UrlHelper::SameOrigin(&self_url, &win_url) {
                Some(window.r().Document())
            } else {
                None
            }
        })
    }

    // Experimental mozbrowser implementation is based on the webidl
    // present in the gecko source tree, and the documentation here:
    // https://developer.mozilla.org/en-US/docs/Web/API/Using_the_Browser_API

    // TODO(gw): Use experimental codegen when it is available to avoid
    // exposing these APIs. See https://github.com/servo/servo/issues/5264.

    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-mozbrowser
    fn Mozbrowser(self) -> bool {
        if opts::experimental_enabled() {
            let element: JSRef<Element> = ElementCast::from_ref(self);
            element.has_attribute(&Atom::from_slice("mozbrowser"))
        } else {
            false
        }
    }

    fn SetMozbrowser(self, value: bool) -> ErrorResult {
        if opts::experimental_enabled() {
            let element: JSRef<Element> = ElementCast::from_ref(self);
            element.set_bool_attribute(&Atom::from_slice("mozbrowser"), value);
        }
        Ok(())
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/goBack
    fn GoBack(self) -> Fallible<()> {
         if self.Mozbrowser() {
            let node: JSRef<Node> = NodeCast::from_ref(self);
            if node.is_in_doc() {
                let window = window_from_node(self).root();
                let window = window.r();

                let pipeline_info = Some((self.containing_page_pipeline_id().unwrap(),
                                          self.subpage_id().unwrap()));
                let ConstellationChan(ref chan) = window.constellation_chan();
                let msg = ConstellationMsg::Navigate(pipeline_info, NavigationDirection::Back);
                chan.send(msg).unwrap();
            }

            Ok(())
        } else {
            debug!("this frame is not mozbrowser (or experimental_enabled is false)");
            Err(NotSupported)
        }
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/goForward
    fn GoForward(self) -> Fallible<()> {
         if self.Mozbrowser() {
            let node: JSRef<Node> = NodeCast::from_ref(self);
            if node.is_in_doc() {
                let window = window_from_node(self).root();
                let window = window.r();

                let pipeline_info = Some((self.containing_page_pipeline_id().unwrap(),
                                          self.subpage_id().unwrap()));
                let ConstellationChan(ref chan) = window.constellation_chan();
                let msg = ConstellationMsg::Navigate(pipeline_info, NavigationDirection::Forward);
                chan.send(msg).unwrap();
            }

            Ok(())
        } else {
            debug!("this frame is not mozbrowser (or experimental_enabled is false)");
            Err(NotSupported)
        }
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/reload
    fn Reload(self, _hardReload: bool) -> Fallible<()> {
        Err(NotSupported)
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/stop
    fn Stop(self) -> Fallible<()> {
        Err(NotSupported)
    }
}

impl<'a> VirtualMethods for JSRef<'a, HTMLIFrameElement> {
    fn super_type<'b>(&'b self) -> Option<&'b VirtualMethods> {
        let htmlelement: &JSRef<HTMLElement> = HTMLElementCast::from_borrowed_ref(self);
        Some(htmlelement as &VirtualMethods)
    }

    fn after_set_attr(&self, attr: JSRef<Attr>) {
        if let Some(ref s) = self.super_type() {
            s.after_set_attr(attr);
        }

        match attr.local_name() {
            &atom!("sandbox") => {
                let mut modes = SandboxAllowance::AllowNothing as u8;
                if let Some(ref tokens) = attr.value().tokens() {
                    for token in tokens.iter() {
                        modes |= match token.as_slice().to_ascii_lowercase().as_slice() {
                            "allow-same-origin" => SandboxAllowance::AllowSameOrigin,
                            "allow-forms" => SandboxAllowance::AllowForms,
                            "allow-pointer-lock" => SandboxAllowance::AllowPointerLock,
                            "allow-popups" => SandboxAllowance::AllowPopups,
                            "allow-scripts" => SandboxAllowance::AllowScripts,
                            "allow-top-navigation" => SandboxAllowance::AllowTopNavigation,
                            _ => SandboxAllowance::AllowNothing
                        } as u8;
                    }
                }
                self.sandbox.set(Some(modes));
            },
            &atom!("src") => {
                let node: JSRef<Node> = NodeCast::from_ref(*self);
                if node.is_in_doc() {
                    self.process_the_iframe_attributes()
                }
            },
            _ => ()
        }
    }

    fn parse_plain_attribute(&self, name: &Atom, value: DOMString) -> AttrValue {
        match name {
            &atom!("sandbox") => AttrValue::from_serialized_tokenlist(value),
            _ => self.super_type().unwrap().parse_plain_attribute(name, value),
        }
    }

    fn before_remove_attr(&self, attr: JSRef<Attr>) {
        if let Some(ref s) = self.super_type() {
           s.before_remove_attr(attr);
        }

        match attr.local_name() {
            &atom!("sandbox") => self.sandbox.set(None),
            _ => ()
        }
    }

    fn bind_to_tree(&self, tree_in_doc: bool) {
        if let Some(ref s) = self.super_type() {
            s.bind_to_tree(tree_in_doc);
        }

        if tree_in_doc {
            self.process_the_iframe_attributes();
        }
    }
}

