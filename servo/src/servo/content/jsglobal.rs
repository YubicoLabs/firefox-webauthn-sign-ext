// Definition for the global object that we use:

import spidermonkey::*;
import spidermonkey::jsapi::*;
import spidermonkey::jsapi::bindgen::*;
import ptr::null;
import jsutil::*;
import name_pool::{name_pool, methods};

// Can't use spidermonkey::crust::* versions due to Rust #2440

crust fn PropertyStub(++arg0: *JSContext, ++arg1: *JSObject, ++arg2: jsid, ++arg3: *jsval) -> JSBool {
    JS_PropertyStub(arg0, arg1, arg2, arg3)
}

crust fn StrictPropertyStub(++arg0: *JSContext, ++arg1: *JSObject, ++arg2: jsid, ++arg3: JSBool, ++arg4: *jsval) -> JSBool {
    JS_StrictPropertyStub(arg0, arg1, arg2, arg3, arg4)
}

crust fn EnumerateStub(++arg0: *JSContext, ++arg1: *JSObject) -> JSBool {
    JS_EnumerateStub(arg0, arg1)
}

crust fn ResolveStub(++arg0: *JSContext,
                     ++arg1: *JSObject,
                     ++arg2: jsid) -> JSBool {
    JS_ResolveStub(arg0, arg1, arg2)
}

crust fn ConvertStub(++arg0: *JSContext,
                     ++arg1: *JSObject,
                     ++arg2: JSType,
                     ++arg3: *jsval) -> JSBool {
    JS_ConvertStub(arg0, arg1, arg2, arg3)
}

fn global_class(np: name_pool) -> JSClass {
    {name: np.add("global"),
     flags: 0x48000_u32,
     addProperty: PropertyStub,
     delProperty: PropertyStub,
     getProperty: PropertyStub,
     setProperty: StrictPropertyStub,
     enumerate: EnumerateStub,
     resolve: ResolveStub,
     convert: ConvertStub,
     finalize: null(),
     reserved0: null(),
     checkAccess: null(),
     call: null(),
     construct: null(),
     xdrObject: null(),
     hasInstance: null(),
     trace: null(),
     reserved1: null(),
     reserved: (null(), null(), null(), null(), null(),  // 05
                null(), null(), null(), null(), null(),  // 10
                null(), null(), null(), null(), null(),  // 15
                null(), null(), null(), null(), null(),  // 20
                null(), null(), null(), null(), null(),  // 25
                null(), null(), null(), null(), null(),  // 30
                null(), null(), null(), null(), null(),  // 35
                null(), null(), null(), null(), null())} // 40
}

crust fn debug(cx: *JSContext, argc: uintN, vp: *jsval) -> JSBool {
    import io::writer_util;

    #debug["debug() called with %? arguments", argc];

    unsafe {
        let argv = JS_ARGV(cx, vp);
        for uint::range(0u, argc as uint) { |i|
            let jsstr = JS_ValueToString(cx, argv[i]);
            let bytes = JS_EncodeString(cx, jsstr);
            let str = str::unsafe::from_c_str(bytes);
            JS_free(cx, unsafe::reinterpret_cast(bytes));
            #debug["%s", str];
        }
        JS_SET_RVAL(cx, vp, JSVAL_NULL);
        ret 1_i32;
    }
}

fn global_fns(np: name_pool) -> [JSFunctionSpec] {
    [{name: np.add("debug"),
      call: debug,
      nargs: 0_u16,
      flags: 0_u16}]
}
