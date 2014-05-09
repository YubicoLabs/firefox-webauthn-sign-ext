/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsTreeStyleCache_h__
#define nsTreeStyleCache_h__

#include "mozilla/Attributes.h"
#include "nsHashtable.h"
#include "nsIAtom.h"
#include "nsCOMArray.h"
#include "nsICSSPseudoComparator.h"
#include "nsRefPtrHashtable.h"
#include "nsStyleContext.h"

typedef nsCOMArray<nsIAtom> AtomArray;

class nsDFAState : public nsHashKey
{
public:
  uint32_t mStateID;

  nsDFAState(uint32_t aID) :mStateID(aID) {}

  uint32_t GetStateID() { return mStateID; }

  uint32_t HashCode(void) const MOZ_OVERRIDE {
    return mStateID;
  }

  bool Equals(const nsHashKey *aKey) const MOZ_OVERRIDE {
    nsDFAState* key = (nsDFAState*)aKey;
    return key->mStateID == mStateID;
  }

  nsHashKey *Clone(void) const MOZ_OVERRIDE {
    return new nsDFAState(mStateID);
  }
};

class nsTreeStyleCache
{
public:
  nsTreeStyleCache()
    : mNextState(0)
  {
  }

  ~nsTreeStyleCache()
  {
    Clear();
  }

  void Clear()
  {
    mTransitionTable = nullptr;
    mCache = nullptr;
    mNextState = 0;
  }

  nsStyleContext* GetStyleContext(nsICSSPseudoComparator* aComparator,
                                  nsPresContext* aPresContext,
                                  nsIContent* aContent,
                                  nsStyleContext* aContext,
                                  nsIAtom* aPseudoElement,
                                  const AtomArray & aInputWord);

protected:

  class Transition MOZ_FINAL
  {
  public:
    Transition(uint32_t aState, nsIAtom* aSymbol);
    bool operator==(const Transition& aOther) const;
    uint32_t Hash() const;

  private:
    uint32_t mState;
    nsCOMPtr<nsIAtom> mInputSymbol;
  };

  typedef nsClassHashtable<nsGenericHashKey<Transition>, nsDFAState> TransitionTable;

  // A transition table for a deterministic finite automaton.  The DFA
  // takes as its input a single pseudoelement and an ordered set of properties.
  // It transitions on an input word that is the concatenation of the pseudoelement supplied
  // with the properties in the array.
  //
  // It transitions from state to state by looking up entries in the transition table (which is
  // a mapping from (S,i)->S', where S is the current state, i is the next
  // property in the input word, and S' is the state to transition to.
  //
  // If S' is not found, it is constructed and entered into the hashtable
  // under the key (S,i).
  //
  // Once the entire word has been consumed, the final state is used
  // to reference the cache table to locate the style context.
  nsAutoPtr<TransitionTable> mTransitionTable;

  // The cache of all active style contexts.  This is a hash from
  // a final state in the DFA, Sf, to the resultant style context.
  typedef nsRefPtrHashtable<nsUint32HashKey, nsStyleContext> StyleContextCache;
  nsAutoPtr<StyleContextCache> mCache;

  // An integer counter that is used when we need to make new states in the
  // DFA.
  uint32_t mNextState;
};

#endif // nsTreeStyleCache_h__
