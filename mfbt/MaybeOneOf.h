/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_MaybeOneOf_h
#define mozilla_MaybeOneOf_h

#include "mozilla/Alignment.h"
#include "mozilla/Assertions.h"
#include "mozilla/Move.h"
#include "mozilla/TemplateLib.h"

// For placement new
#include <new>

namespace mozilla {

/*
 * MaybeOneOf<T1, T2> is like Maybe, but it supports constructing either T1
 * or T2. When a MaybeOneOf<T1, T2> is constructed, it is |empty()|, i.e.,
 * no value has been constructed and no destructor will be called when the
 * MaybeOneOf<T1, T2> is destroyed. Upon calling |construct<T1>()| or
 * |construct<T2>()|, a T1 or T2 object will be constructed with the given
 * arguments and that object will be destroyed when the owning MaybeOneOf is
 * destroyed.
 */
template<class T1, class T2>
class MaybeOneOf
{
  AlignedStorage<tl::Max<sizeof(T1), sizeof(T2)>::value> storage;

  enum State { None, SomeT1, SomeT2 } state;
  template <class T, class Ignored = void> struct Type2State {};

  template <class T>
  T& as() {
    MOZ_ASSERT(state == Type2State<T>::result);
    return *(T*)storage.addr();
  }

  template <class T>
  const T& as() const {
    MOZ_ASSERT(state == Type2State<T>::result);
    return *(T*)storage.addr();
  }

 public:
  MaybeOneOf() : state(None) {}
  ~MaybeOneOf() { destroyIfConstructed(); }

  bool empty() const { return state == None; }

  template <class T>
  bool constructed() const { return state == Type2State<T>::result; }

  template <class T>
  void construct() {
    MOZ_ASSERT(state == None);
    state = Type2State<T>::result;
    ::new (storage.addr()) T();
  }

  template <class T, class U>
  void construct(U&& u) {
    MOZ_ASSERT(state == None);
    state = Type2State<T>::result;
    ::new (storage.addr()) T(Move(u));
  }

  template <class T, class U1>
  void construct(const U1& u1) {
    MOZ_ASSERT(state == None);
    state = Type2State<T>::result;
    ::new (storage.addr()) T(u1);
  }

  template <class T, class U1, class U2>
  void construct(const U1& u1, const U2& u2) {
    MOZ_ASSERT(state == None);
    state = Type2State<T>::result;
    ::new (storage.addr()) T(u1, u2);
  }

  template <class T>
  T& ref() {
    return as<T>();
  }

  template <class T>
  const T& ref() const {
    return as<T>();
  }

  void destroy() {
    MOZ_ASSERT(state == SomeT1 || state == SomeT2);
    if (state == SomeT1)
      as<T1>().~T1();
    else if (state == SomeT2)
      as<T2>().~T2();
    state = None;
  }

  void destroyIfConstructed() {
    if (!empty())
      destroy();
  }

  private:
    MaybeOneOf(const MaybeOneOf& other) MOZ_DELETE;
    const MaybeOneOf& operator=(const MaybeOneOf& other) MOZ_DELETE;
};

template <class T1, class T2>
template <class Ignored>
struct MaybeOneOf<T1, T2>::Type2State<T1, Ignored> {
  typedef MaybeOneOf<T1, T2> Enclosing;
  static const typename Enclosing::State result = Enclosing::SomeT1;
};

template <class T1, class T2>
template <class Ignored>
struct MaybeOneOf<T1, T2>::Type2State<T2, Ignored> {
  typedef MaybeOneOf<T1, T2> Enclosing;
  static const typename Enclosing::State result = Enclosing::SomeT2;
};

} // namespace mozilla

#endif /* mozilla_MaybeOneOf_h */
