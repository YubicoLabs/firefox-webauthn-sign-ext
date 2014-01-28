/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sts=4 et sw=4 tw=99:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef jit_IonTypes_h
#define jit_IonTypes_h

#include "jstypes.h"

#include "js/Value.h"

namespace js {
namespace jit {

typedef uint32_t SnapshotOffset;
typedef uint32_t BailoutId;

static const SnapshotOffset INVALID_SNAPSHOT_OFFSET = uint32_t(-1);

// Different kinds of bailouts. When extending this enum, make sure to check
// the bits reserved for bailout kinds in Bailouts.h
enum BailoutKind
{
    // A normal bailout triggered from type, shape, and assorted overflow
    // guards in the compiler.
    Bailout_Normal,

    // A bailout at the very start of a function indicates that there may be
    // a type mismatch in the arguments that necessitates a reflow.
    Bailout_ArgumentCheck,

    // A bailout triggered by a bounds-check failure.
    Bailout_BoundsCheck,

    // A shape guard based on TI information failed.
    Bailout_ShapeGuard,

    // A bailout caused by invalid assumptions based on Baseline code.
    Bailout_BaselineInfo
};

#ifdef DEBUG
inline const char *
BailoutKindString(BailoutKind kind)
{
    switch (kind) {
      case Bailout_Normal:
        return "Bailout_Normal";
      case Bailout_ArgumentCheck:
        return "Bailout_ArgumentCheck";
      case Bailout_BoundsCheck:
        return "Bailout_BoundsCheck";
      case Bailout_ShapeGuard:
        return "Bailout_ShapeGuard";
      case Bailout_BaselineInfo:
        return "Bailout_BaselineInfo";
      default:
        MOZ_ASSUME_UNREACHABLE("Invalid BailoutKind");
    }
}
#endif

static const uint32_t ELEMENT_TYPE_BITS = 4;
static const uint32_t ELEMENT_TYPE_SHIFT = 0;
static const uint32_t ELEMENT_TYPE_MASK = (1 << ELEMENT_TYPE_BITS) - 1;
static const uint32_t VECTOR_SCALE_BITS = 2;
static const uint32_t VECTOR_SCALE_SHIFT = ELEMENT_TYPE_BITS + ELEMENT_TYPE_SHIFT;
static const uint32_t VECTOR_SCALE_MASK = (1 << VECTOR_SCALE_BITS) - 1;

// The ordering of this enumeration is important: Anything < Value is a
// specialized type. Furthermore, anything < String has trivial conversion to
// a number.
enum MIRType
{
    MIRType_Undefined,
    MIRType_Null,
    MIRType_Boolean,
    MIRType_Int32,
    MIRType_Double,
    MIRType_Float32,
    MIRType_String,
    MIRType_Object,
    MIRType_Magic,
    MIRType_Value,
    MIRType_None,          // Invalid, used as a placeholder.
    MIRType_Slots,         // A slots vector
    MIRType_Elements,      // An elements vector
    MIRType_Pointer,       // An opaque pointer that receives no special treatment
    MIRType_Shape,         // A Shape pointer.
    MIRType_ForkJoinSlice, // js::ForkJoinSlice*
    MIRType_Last = MIRType_ForkJoinSlice,
    MIRType_Float32x4 = MIRType_Float32 | (2 << VECTOR_SCALE_SHIFT),
    MIRType_Int32x4   = MIRType_Int32   | (2 << VECTOR_SCALE_SHIFT),
    MIRType_Doublex2  = MIRType_Double  | (1 << VECTOR_SCALE_SHIFT)
};

static inline MIRType
ElementType(MIRType type)
{
    JS_STATIC_ASSERT(MIRType_Last <= ELEMENT_TYPE_MASK);
    return static_cast<MIRType>((type >> ELEMENT_TYPE_SHIFT) & ELEMENT_TYPE_MASK);
}

static inline uint32_t
VectorSize(MIRType type)
{
    return 1 << ((type >> VECTOR_SCALE_SHIFT) & VECTOR_SCALE_MASK);
}

static inline MIRType
MIRTypeFromValueType(JSValueType type)
{
    switch (type) {
      case JSVAL_TYPE_DOUBLE:
        return MIRType_Double;
      case JSVAL_TYPE_INT32:
        return MIRType_Int32;
      case JSVAL_TYPE_UNDEFINED:
        return MIRType_Undefined;
      case JSVAL_TYPE_STRING:
        return MIRType_String;
      case JSVAL_TYPE_BOOLEAN:
        return MIRType_Boolean;
      case JSVAL_TYPE_NULL:
        return MIRType_Null;
      case JSVAL_TYPE_OBJECT:
        return MIRType_Object;
      case JSVAL_TYPE_MAGIC:
        return MIRType_Magic;
      case JSVAL_TYPE_UNKNOWN:
        return MIRType_Value;
      default:
        MOZ_ASSUME_UNREACHABLE("unexpected jsval type");
    }
}

static inline JSValueType
ValueTypeFromMIRType(MIRType type)
{
  switch (type) {
    case MIRType_Undefined:
      return JSVAL_TYPE_UNDEFINED;
    case MIRType_Null:
      return JSVAL_TYPE_NULL;
    case MIRType_Boolean:
      return JSVAL_TYPE_BOOLEAN;
    case MIRType_Int32:
      return JSVAL_TYPE_INT32;
    case MIRType_Float32: // Fall through, there's no JSVAL for Float32
    case MIRType_Double:
      return JSVAL_TYPE_DOUBLE;
    case MIRType_String:
      return JSVAL_TYPE_STRING;
    case MIRType_Magic:
      return JSVAL_TYPE_MAGIC;
    default:
      JS_ASSERT(type == MIRType_Object);
      return JSVAL_TYPE_OBJECT;
  }
}

static inline JSValueTag
MIRTypeToTag(MIRType type)
{
    return JSVAL_TYPE_TO_TAG(ValueTypeFromMIRType(type));
}

static inline const char *
StringFromMIRType(MIRType type)
{
  switch (type) {
    case MIRType_Undefined:
      return "Undefined";
    case MIRType_Null:
      return "Null";
    case MIRType_Boolean:
      return "Bool";
    case MIRType_Int32:
      return "Int32";
    case MIRType_Double:
      return "Double";
    case MIRType_Float32:
      return "Float32";
    case MIRType_String:
      return "String";
    case MIRType_Object:
      return "Object";
    case MIRType_Magic:
      return "Magic";
    case MIRType_Value:
      return "Value";
    case MIRType_None:
      return "None";
    case MIRType_Slots:
      return "Slots";
    case MIRType_Elements:
      return "Elements";
    case MIRType_Pointer:
      return "Pointer";
    case MIRType_ForkJoinSlice:
      return "ForkJoinSlice";
    default:
      MOZ_ASSUME_UNREACHABLE("Unknown MIRType.");
  }
}

static inline bool
IsNumberType(MIRType type)
{
    return type == MIRType_Int32 || type == MIRType_Double || type == MIRType_Float32;
}

static inline bool
IsFloatType(MIRType type)
{
    return type == MIRType_Int32 || type == MIRType_Float32;
}

static inline bool
IsFloatingPointType(MIRType type)
{
    return type == MIRType_Double || type == MIRType_Float32;
}

static inline bool
IsNullOrUndefined(MIRType type)
{
    return type == MIRType_Null || type == MIRType_Undefined;
}

#ifdef DEBUG
// Track the pipeline of opcodes which has produced a snapshot.
#define TRACK_SNAPSHOTS 1

// Make sure registers are not modified between an instruction and
// its OsiPoint.
//
// Skip this check in rooting analysis builds, which poison unrooted
// pointers on the stack.
#  if defined(JS_ION) && !defined(JSGC_ROOT_ANALYSIS)
#    define CHECK_OSIPOINT_REGISTERS 1
#  endif
#endif

} // namespace jit
} // namespace js

#endif /* jit_IonTypes_h */
