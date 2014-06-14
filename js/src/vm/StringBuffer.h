/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sts=4 et sw=4 tw=99:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef vm_StringBuffer_h
#define vm_StringBuffer_h

#include "mozilla/DebugOnly.h"
#include "mozilla/MaybeOneOf.h"

#include "jscntxt.h"

#include "js/Vector.h"

namespace js {

/*
 * String builder that eagerly checks for over-allocation past the maximum
 * string length.
 *
 * Any operation which would exceed the maximum string length causes an
 * exception report on the context and results in a failed return value.
 *
 * Well-sized extractions (which waste no more than 1/4 of their char
 * buffer space) are guaranteed for strings built by this interface.
 * See |extractWellSized|.
 */
class StringBuffer
{
    /*
     * The Vector's buffer is taken by the new string so use
     * ContextAllocPolicy.
     */
    typedef Vector<Latin1Char, 64, ContextAllocPolicy> Latin1CharBuffer;
    typedef Vector<jschar, 32, ContextAllocPolicy> TwoByteCharBuffer;

    ExclusiveContext *cx;

    /*
     * If Latin1 strings are enabled, cb starts out as a Latin1CharBuffer. When
     * a TwoByte char is appended, inflateChars() constructs a TwoByteCharBuffer
     * and copies the Latin1 chars.
     */
    mozilla::MaybeOneOf<Latin1CharBuffer, TwoByteCharBuffer> cb;

    /*
     * Make sure ensureTwoByteChars() is called before calling
     * infallibleAppend(jschar).
     */
    mozilla::DebugOnly<bool> hasEnsuredTwoByteChars_;

    StringBuffer(const StringBuffer &other) MOZ_DELETE;
    void operator=(const StringBuffer &other) MOZ_DELETE;

    MOZ_ALWAYS_INLINE bool isLatin1() const { return cb.constructed<Latin1CharBuffer>(); }
    MOZ_ALWAYS_INLINE bool isTwoByte() const { return !isLatin1(); }

    MOZ_ALWAYS_INLINE Latin1CharBuffer &latin1Chars() { return cb.ref<Latin1CharBuffer>(); }
    MOZ_ALWAYS_INLINE TwoByteCharBuffer &twoByteChars() { return cb.ref<TwoByteCharBuffer>(); }

    MOZ_ALWAYS_INLINE const Latin1CharBuffer &latin1Chars() const {
        return cb.ref<Latin1CharBuffer>();
    }
    MOZ_ALWAYS_INLINE const TwoByteCharBuffer &twoByteChars() const {
        return cb.ref<TwoByteCharBuffer>();
    }

    static const Latin1Char MaxLatin1Char = 0xff;

    bool inflateChars();

  public:
    explicit StringBuffer(ExclusiveContext *cx)
      : cx(cx), hasEnsuredTwoByteChars_(false)
    {
        if (EnableLatin1Strings)
            cb.construct<Latin1CharBuffer>(cx);
        else
            cb.construct<TwoByteCharBuffer>(cx);
    }

    inline bool reserve(size_t len) {
        return isLatin1() ? latin1Chars().reserve(len) : twoByteChars().reserve(len);
    }
    inline bool resize(size_t len) {
        return isLatin1() ? latin1Chars().resize(len) : twoByteChars().resize(len);
    }
    inline bool empty() const {
        return isLatin1() ? latin1Chars().empty() : twoByteChars().empty();
    }
    inline size_t length() const {
        return isLatin1() ? latin1Chars().length() : twoByteChars().length();
    }
    inline jschar getChar(size_t idx) const {
        return isLatin1() ? latin1Chars()[idx] : twoByteChars()[idx];
    }

    inline bool ensureTwoByteChars() {
        if (isLatin1() && !inflateChars())
            return false;

        hasEnsuredTwoByteChars_ = true;
        return true;
    }

    inline bool append(const jschar c) {
        if (isLatin1()) {
            if (c <= MaxLatin1Char)
                return latin1Chars().append(Latin1Char(c));
            if (!inflateChars())
                return false;
        }
        return twoByteChars().append(c);
    }
    inline bool append(Latin1Char c) {
        return isLatin1() ? latin1Chars().append(c) : twoByteChars().append(c);
    }
    inline bool append(char c) {
        return append(Latin1Char(c));
    }

    inline bool append(const jschar *begin, const jschar *end);
    inline bool append(const jschar *chars, size_t len) {
        return append(chars, chars + len);
    }

    inline bool append(const Latin1Char *begin, const Latin1Char *end) {
        return isLatin1() ? latin1Chars().append(begin, end) : twoByteChars().append(begin, end);
    }
    inline bool append(const Latin1Char *chars, size_t len) {
        return append(chars, chars + len);
    }

    inline bool append(const JS::ConstCharPtr chars, size_t len) {
        return append(chars.get(), chars.get() + len);
    }
    inline bool appendN(Latin1Char c, size_t n) {
        return isLatin1() ? latin1Chars().appendN(c, n) : twoByteChars().appendN(c, n);
    }

    inline bool append(JSString *str);
    inline bool append(JSLinearString *str);
    inline bool appendSubstring(JSString *base, size_t off, size_t len);
    inline bool appendSubstring(JSLinearString *base, size_t off, size_t len);

    inline bool append(const char *chars, size_t len) {
        return append(reinterpret_cast<const Latin1Char *>(chars), len);
    }

    template <size_t ArrayLength>
    bool append(const char (&array)[ArrayLength]) {
        return append(array, ArrayLength - 1); /* No trailing '\0'. */
    }

    /* Infallible variants usable when the corresponding space is reserved. */
    void infallibleAppend(Latin1Char c) {
        if (isLatin1())
            latin1Chars().infallibleAppend(c);
        else
            twoByteChars().infallibleAppend(c);
    }
    void infallibleAppend(char c) {
        infallibleAppend(Latin1Char(c));
    }
    void infallibleAppend(const Latin1Char *chars, size_t len) {
        if (isLatin1())
            latin1Chars().infallibleAppend(chars, len);
        else
            twoByteChars().infallibleAppend(chars, len);
    }
    void infallibleAppend(const char *chars, size_t len) {
        infallibleAppend(reinterpret_cast<const Latin1Char *>(chars), len);
    }

    /*
     * Because inflation is fallible, these methods should only be used after
     * calling ensureTwoByteChars().
     */
    void infallibleAppend(const jschar *chars, size_t len) {
        MOZ_ASSERT(hasEnsuredTwoByteChars_);
        twoByteChars().infallibleAppend(chars, len);
    }
    void infallibleAppend(jschar c) {
        MOZ_ASSERT(hasEnsuredTwoByteChars_);
        twoByteChars().infallibleAppend(c);
    }

    bool isUnderlyingBufferLatin1() const { return isLatin1(); }

    jschar *rawTwoByteBegin() { return twoByteChars().begin(); }
    jschar *rawTwoByteEnd() { return twoByteChars().end(); }
    const jschar *rawTwoByteBegin() const { return twoByteChars().begin(); }
    const jschar *rawTwoByteEnd() const { return twoByteChars().end(); }

    Latin1Char *rawLatin1Begin() { return latin1Chars().begin(); }
    Latin1Char *rawLatin1End() { return latin1Chars().end(); }
    const Latin1Char *rawLatin1Begin() const { return latin1Chars().begin(); }
    const Latin1Char *rawLatin1End() const { return latin1Chars().end(); }

    /*
     * Creates a string from the characters in this buffer, then (regardless
     * whether string creation succeeded or failed) empties the buffer.
     */
    JSFlatString *finishString();

    /* Identical to finishString() except that an atom is created. */
    JSAtom *finishAtom();

    /*
     * Creates a raw string from the characters in this buffer.  The string is
     * exactly the characters in this buffer (inflated to TwoByte), it is *not*
     * null-terminated unless the last appended character was '\0'.
     */
    jschar *stealChars();
};

inline bool
StringBuffer::append(const jschar *begin, const jschar *end)
{
    MOZ_ASSERT(begin <= end);
    if (isLatin1()) {
        while (true) {
            if (begin >= end)
                return true;
            if (*begin > MaxLatin1Char)
                break;
            if (!latin1Chars().append(*begin))
                return false;
            ++begin;
        }
        if (!inflateChars())
            return false;
    }
    return twoByteChars().append(begin, end);
}

inline bool
StringBuffer::append(JSLinearString *str)
{
    JS::AutoCheckCannotGC nogc;
    if (isLatin1()) {
        if (str->hasLatin1Chars())
            return latin1Chars().append(str->latin1Chars(nogc), str->length());
        if (!inflateChars())
            return false;
    }
    return twoByteChars().append(str->twoByteChars(nogc), str->length());
}

inline bool
StringBuffer::appendSubstring(JSLinearString *base, size_t off, size_t len)
{
    MOZ_ASSERT(off + len <= base->length());

    JS::AutoCheckCannotGC nogc;
    if (isLatin1()) {
        if (base->hasLatin1Chars())
            return latin1Chars().append(base->latin1Chars(nogc) + off, len);
        if (!inflateChars())
            return false;
    }
    return twoByteChars().append(base->twoByteChars(nogc) + off, len);
}

inline bool
StringBuffer::appendSubstring(JSString *base, size_t off, size_t len)
{
    JSLinearString *linear = base->ensureLinear(cx);
    if (!linear)
        return false;

    return appendSubstring(linear, off, len);
}

inline bool
StringBuffer::append(JSString *str)
{
    JSLinearString *linear = str->ensureLinear(cx);
    if (!linear)
        return false;

    return append(linear);
}

/* ES5 9.8 ToString, appending the result to the string buffer. */
extern bool
ValueToStringBufferSlow(JSContext *cx, const Value &v, StringBuffer &sb);

inline bool
ValueToStringBuffer(JSContext *cx, const Value &v, StringBuffer &sb)
{
    if (v.isString())
        return sb.append(v.toString());

    return ValueToStringBufferSlow(cx, v, sb);
}

/* ES5 9.8 ToString for booleans, appending the result to the string buffer. */
inline bool
BooleanToStringBuffer(bool b, StringBuffer &sb)
{
    return b ? sb.append("true") : sb.append("false");
}

}  /* namespace js */

#endif /* vm_StringBuffer_h */
