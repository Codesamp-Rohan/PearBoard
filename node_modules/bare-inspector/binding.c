#include <assert.h>
#include <bare.h>
#include <js.h>

typedef struct {
  js_inspector_t *handle;

  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *on_response;
  js_ref_t *on_paused;
} bare_inspector_t;

static void
bare_inspector__on_response(js_env_t *env, js_inspector_t *handle, js_value_t *message, void *data) {
  int err;

  bare_inspector_t *inspector = (bare_inspector_t *) data;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, inspector->ctx, &ctx);
  assert(err == 0);

  js_value_t *callback;
  err = js_get_reference_value(env, inspector->on_response, &callback);
  assert(err == 0);

  js_call_function(env, ctx, callback, 1, &message, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static bool
bare_inspector__on_paused(js_env_t *env, js_inspector_t *handle, void *data) {
  int err;

  bare_inspector_t *inspector = (bare_inspector_t *) data;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, inspector->ctx, &ctx);
  assert(err == 0);

  js_value_t *callback;
  err = js_get_reference_value(env, inspector->on_paused, &callback);
  assert(err == 0);

  js_value_t *result;
  err = js_call_function(env, ctx, callback, 0, NULL, &result);

  bool value;

  if (err < 0) value = false;
  else {
    err = js_get_value_bool(env, result, &value);
    assert(err == 0);
  }

  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  return value;
}

static js_value_t *
bare_inspector_create(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  js_value_t *handle;

  bare_inspector_t *inspector;
  err = js_create_arraybuffer(env, sizeof(bare_inspector_t), (void **) &inspector, &handle);
  assert(err == 0);

  err = js_create_inspector(env, &inspector->handle);
  assert(err == 0);

  err = js_on_inspector_response(env, inspector->handle, bare_inspector__on_response, (void *) inspector);
  assert(err == 0);

  err = js_on_inspector_paused(env, inspector->handle, bare_inspector__on_paused, (void *) inspector);
  assert(err == 0);

  inspector->env = env;

  err = js_create_reference(env, argv[0], 1, &inspector->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[1], 1, &inspector->on_response);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &inspector->on_paused);
  assert(err == 0);

  return handle;
}

static js_value_t *
bare_inspector_destroy(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_inspector_t *inspector;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &inspector, NULL);
  assert(err == 0);

  err = js_destroy_inspector(env, inspector->handle);
  assert(err == 0);

  err = js_delete_reference(env, inspector->on_response);
  assert(err == 0);

  err = js_delete_reference(env, inspector->on_paused);
  assert(err == 0);

  err = js_delete_reference(env, inspector->ctx);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_inspector_connect(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_inspector_t *inspector;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &inspector, NULL);
  assert(err == 0);

  err = js_connect_inspector(env, inspector->handle);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_inspector_post(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_inspector_t *inspector;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &inspector, NULL);
  assert(err == 0);

  err = js_send_inspector_request(env, inspector->handle, argv[1]);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_inspector_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("create", bare_inspector_create)
  V("destroy", bare_inspector_destroy)
  V("connect", bare_inspector_connect)
  V("post", bare_inspector_post)
#undef V

  js_value_t *bindings;
  err = js_get_bindings(env, &bindings);
  assert(err == 0);

  js_value_t *console;
  err = js_get_named_property(env, bindings, "console", &console);
  assert(err == 0);

  err = js_set_named_property(env, exports, "console", console);
  assert(err == 0);

  return exports;
}

BARE_MODULE(bare_inspector, bare_inspector_exports)
