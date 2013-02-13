/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#pragma once

#include <windows.system.h>
#include <windows.ui.core.h>
#include <UIAutomation.h>

namespace mozilla {
namespace widget {
namespace winrt {

// Factory function for UIABridge
HRESULT UIABridge_CreateInstance(IInspectable **retVal);

} } }
