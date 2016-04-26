/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

<%namespace name="helpers" file="/helpers.mako.rs" />

<% data.new_style_struct("Pointing", inherited=True, gecko_ffi_name="nsStyleUserInterface") %>

<%helpers:longhand name="cursor">
    pub use self::computed_value::T as SpecifiedValue;
    use values::computed::ComputedValueAsSpecified;

    impl ComputedValueAsSpecified for SpecifiedValue {}

    pub mod computed_value {
        use cssparser::ToCss;
        use std::fmt;
        use style_traits::cursor::Cursor;

        #[derive(Clone, PartialEq, Eq, Copy, Debug, HeapSizeOf)]
        pub enum T {
            AutoCursor,
            SpecifiedCursor(Cursor),
        }

        impl ToCss for T {
            fn to_css<W>(&self, dest: &mut W) -> fmt::Result where W: fmt::Write {
                match *self {
                    T::AutoCursor => dest.write_str("auto"),
                    T::SpecifiedCursor(c) => c.to_css(dest),
                }
            }
        }
    }

    #[inline]
    pub fn get_initial_value() -> computed_value::T {
        computed_value::T::AutoCursor
    }
    pub fn parse(_context: &ParserContext, input: &mut Parser) -> Result<SpecifiedValue, ()> {
        use std::ascii::AsciiExt;
        use style_traits::cursor::Cursor;
        let ident = try!(input.expect_ident());
        if ident.eq_ignore_ascii_case("auto") {
            Ok(SpecifiedValue::AutoCursor)
        } else {
            Cursor::from_css_keyword(&ident)
            .map(SpecifiedValue::SpecifiedCursor)
        }
    }
</%helpers:longhand>

// NB: `pointer-events: auto` (and use of `pointer-events` in anything that isn't SVG, in fact)
// is nonstandard, slated for CSS4-UI.
// TODO(pcwalton): SVG-only values.
${helpers.single_keyword("pointer-events", "auto none")}
