/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsTreeStyleCache.h"
#include "nsStyleSet.h"
#include "mozilla/dom/Element.h"

nsTreeStyleCache::Transition::Transition(uint32_t aState, nsIAtom* aSymbol)
  : mState(aState), mInputSymbol(aSymbol)
{
}

bool
nsTreeStyleCache::Transition::operator==(const Transition& aOther) const
{
  return aOther.mState == mState && aOther.mInputSymbol == mInputSymbol;
}

uint32_t
nsTreeStyleCache::Transition::Hash() const
{
  // Make a 32-bit integer that combines the low-order 16 bits of the state and the input symbol.
  uint32_t hb = mState << 16;
  uint32_t lb = (NS_PTR_TO_UINT32(mInputSymbol.get()) << 16) >> 16;
  return hb+lb;
}


// The style context cache impl
nsStyleContext*
nsTreeStyleCache::GetStyleContext(nsICSSPseudoComparator* aComparator,
                                  nsPresContext* aPresContext,
                                  nsIContent* aContent,
                                  nsStyleContext* aContext,
                                  nsIAtom* aPseudoElement,
                                  const AtomArray & aInputWord)
{
  uint32_t count = aInputWord.Length();

  // Go ahead and init the transition table.
  if (!mTransitionTable) {
    // Automatic miss. Build the table
    mTransitionTable = new TransitionTable();
  }

  // The first transition is always made off the supplied pseudo-element.
  Transition transition(0, aPseudoElement);
  nsDFAState* currState = mTransitionTable->Get(transition);

  if (!currState) {
    // We had a miss. Make a new state and add it to our hash.
    currState = new nsDFAState(mNextState);
    mNextState++;
    mTransitionTable->Put(transition, currState);
  }

  for (uint32_t i = 0; i < count; i++) {
    Transition transition(currState->GetStateID(), aInputWord[i]);
    currState = mTransitionTable->Get(transition);

    if (!currState) {
      // We had a miss. Make a new state and add it to our hash.
      currState = new nsDFAState(mNextState);
      mNextState++;
      mTransitionTable->Put(transition, currState);
    }
  }

  // We're in a final state.
  // Look up our style context for this state.
  nsStyleContext* result = nullptr;
  if (mCache) {
    result = mCache->GetWeak(currState->GetStateID());
  }
  if (!result) {
    // We missed the cache. Resolve this pseudo-style.
    nsRefPtr<nsStyleContext> newResult = aPresContext->StyleSet()->
      ResolveXULTreePseudoStyle(aContent->AsElement(), aPseudoElement,
                                aContext, aComparator);

    // Put the style context in our table, transferring the owning reference to the table.
    if (!mCache) {
      mCache = new StyleContextCache();
    }
    result = newResult.get();
    mCache->Put(currState->GetStateID(), newResult.forget());
  }

  return result;
}

