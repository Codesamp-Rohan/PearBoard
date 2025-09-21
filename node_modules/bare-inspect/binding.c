#include <assert.h>
#include <bare.h>
#include <js.h>

static js_value_t *
bare_inspect_get_promise_state(js_env_t *env, js_callback_info_t *info) {
  int err;

  js_value_t *argv[1];
  size_t argc = 1;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  js_promise_state_t state;
  err = js_get_promise_state(env, argv[0], &state);
  assert(err == 0);

  js_value_t *result;
  err = js_create_uint32(env, state, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_inspect_get_promise_result(js_env_t *env, js_callback_info_t *info) {
  int err;

  js_value_t *argv[1];
  size_t argc = 1;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  js_value_t *result;
  err = js_get_promise_result(env, argv[0], &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_inspect_get_external(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  void *data;
  err = js_get_value_external(env, argv[0], &data);
  assert(err == 0);

  js_value_t *result;
  err = js_create_bigint_uint64(env, (uintptr_t) data, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_inspect_get_own_non_index_property_names(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  js_value_t *result;
  err = js_get_filtered_property_names(env, argv[0], js_key_own_only, js_property_only_enumerable, js_index_skip_indices, js_key_convert_to_string, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_inspect_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("getPromiseState", bare_inspect_get_promise_state)
  V("getPromiseResult", bare_inspect_get_promise_result)
  V("getExternal", bare_inspect_get_external)
  V("getOwnNonIndexPropertyNames", bare_inspect_get_own_non_index_property_names)
#undef V

  return exports;
}

BARE_MODULE(bare_inspect, bare_inspect_exports)
