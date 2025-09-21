#include <assert.h>
#include <bare.h>
#include <js.h>
#include <uv.h>

static js_value_t *
bare_hrtime(js_env_t *env, js_callback_info_t *info) {
  int err;

  js_value_t *result;
  err = js_create_bigint_uint64(env, uv_hrtime(), &result);
  assert(err == 0);

  return result;
}

static int64_t
bare_hrtime_typed(js_value_t *receiver) {
  return uv_hrtime();
}

static js_value_t *
bare_hrtime_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, untyped, signature, typed) \
  { \
    js_value_t *val; \
    if (signature) { \
      err = js_create_typed_function(env, name, -1, untyped, signature, typed, NULL, &val); \
      assert(err == 0); \
    } else { \
      err = js_create_function(env, name, -1, untyped, NULL, &val); \
      assert(err == 0); \
    } \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V(
    "hrtime",
    bare_hrtime,
    &((js_callback_signature_t) {
      .version = 0,
      .result = js_biguint64,
      .args_len = 1,
      .args = (int[]) {
        js_object,
      },
    }),
    bare_hrtime_typed
  );
#undef V

  return exports;
}

BARE_MODULE(bare_hrtime, bare_hrtime_exports)
