#include <assert.h>
#include <bare.h>
#include <js.h>
#include <openssl/bytestring.h>
#include <openssl/cipher.h>
#include <openssl/curve25519.h>
#include <openssl/digest.h>
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/mem.h>
#include <openssl/rand.h>
#include <stddef.h>

enum {
  // Digests
  bare_crypto_md5 = 1,
  bare_crypto_sha1,
  bare_crypto_sha256,
  bare_crypto_sha512,
  bare_crypto_blake2b256,

  // Unauthenticated ciphers
  bare_crypto_aes_128_ecb,
  bare_crypto_aes_128_cbc,
  bare_crypto_aes_128_ctr,
  bare_crypto_aes_128_ofb,
  bare_crypto_aes_256_ecb,
  bare_crypto_aes_256_cbc,
  bare_crypto_aes_256_ctr,
  bare_crypto_aes_256_ofb,

  // Authenticated ciphers
  bare_crypto_aes_128_gcm,
  bare_crypto_aes_256_gcm,
  bare_crypto_chacha20_poly1305,
  bare_crypto_xchacha20_poly1305,

  // Signature algorithms
  bare_crypto_ed25519,
};

typedef struct {
  EVP_MD_CTX context;
} bare_crypto_hash_t;

typedef struct {
  HMAC_CTX context;
} bare_crypto_hmac_t;

typedef struct {
  EVP_CIPHER_CTX context;
} bare_crypto_cipher_t;

typedef struct {
  EVP_AEAD_CTX context;
} bare_crypto_aead_t;

static inline const EVP_MD *
bare_crypto__to_hash(js_env_t *env, int type) {
  int err;

  switch (type) {
#define V(algorithm) \
  case bare_crypto_##algorithm: \
    return EVP_##algorithm();

    V(md5)
    V(sha1)
    V(sha256)
    V(sha512)
    V(blake2b256)
#undef V

  default:
    err = js_throw_error(env, NULL, "Unknown hash algorithm");
    assert(err == 0);

    return NULL;
  }
}

static inline const EVP_CIPHER *
bare_crypto__to_cipher(js_env_t *env, int type) {
  int err;

  switch (type) {
#define V(algorithm) \
  case bare_crypto_##algorithm: \
    return EVP_##algorithm();

    V(aes_128_ecb)
    V(aes_128_cbc)
    V(aes_128_ctr)
    V(aes_128_ofb)
    V(aes_256_ecb)
    V(aes_256_cbc)
    V(aes_256_ctr)
    V(aes_256_ofb)
#undef V

  default:
    err = js_throw_error(env, NULL, "Unknown cipher algorithm");
    assert(err == 0);

    return NULL;
  }
}

static inline const EVP_AEAD *
bare_crypto__to_aead(js_env_t *env, int type) {
  int err;

  switch (type) {
#define V(algorithm) \
  case bare_crypto_##algorithm: \
    return EVP_aead_##algorithm();

    V(aes_128_gcm)
    V(aes_256_gcm)
    V(chacha20_poly1305)
    V(xchacha20_poly1305)
#undef V

  default:
    err = js_throw_error(env, NULL, "Unknown cipher algorithm");
    assert(err == 0);

    return NULL;
  }
}

static js_value_t *
bare_crypto_hash_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint32_t type;
  err = js_get_value_uint32(env, argv[0], &type);
  assert(err == 0);

  js_value_t *handle;

  bare_crypto_hash_t *hash;
  err = js_create_arraybuffer(env, sizeof(bare_crypto_hash_t), (void **) &hash, &handle);
  assert(err == 0);

  const EVP_MD *algorithm = bare_crypto__to_hash(env, type);

  if (algorithm == NULL) return NULL;

  EVP_MD_CTX_init(&hash->context);

  err = EVP_DigestInit(&hash->context, algorithm);
  assert(err == 1);

  return handle;
}

static js_value_t *
bare_crypto_hash_update(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_crypto_hash_t *hash;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &hash, NULL);
  assert(err == 0);

  void *data;
  err = js_get_arraybuffer_info(env, argv[1], &data, NULL);
  assert(err == 0);

  int64_t offset;
  err = js_get_value_int64(env, argv[2], &offset);
  assert(err == 0);

  int64_t len;
  err = js_get_value_int64(env, argv[3], &len);
  assert(err == 0);

  err = EVP_DigestUpdate(&hash->context, &data[offset], len);
  assert(err == 1);

  return NULL;
}

static js_value_t *
bare_crypto_hash_final(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_crypto_hash_t *hash;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &hash, NULL);
  assert(err == 0);

  js_value_t *result;

  size_t len = EVP_MD_CTX_size(&hash->context);

  uint8_t *digest;
  err = js_create_arraybuffer(env, len, (void **) &digest, &result);
  assert(err == 0);

  err = EVP_DigestFinal(&hash->context, digest, NULL);
  assert(err == 1);

  return result;
}

static js_value_t *
bare_crypto_hmac_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  uint32_t type;
  err = js_get_value_uint32(env, argv[0], &type);
  assert(err == 0);

  char *key;
  err = js_get_arraybuffer_info(env, argv[1], (void **) &key, NULL);
  assert(err == 0);

  int64_t offset;
  err = js_get_value_int64(env, argv[2], &offset);
  assert(err == 0);

  int64_t len;
  err = js_get_value_int64(env, argv[3], &len);
  assert(err == 0);

  js_value_t *handle;

  bare_crypto_hmac_t *hmac;
  err = js_create_arraybuffer(env, sizeof(bare_crypto_hmac_t), (void **) &hmac, &handle);
  assert(err == 0);

  const EVP_MD *algorithm = bare_crypto__to_hash(env, type);

  if (algorithm == NULL) return NULL;

  HMAC_CTX_init(&hmac->context);

  err = HMAC_Init_ex(&hmac->context, &key[offset], len, algorithm, NULL);
  assert(err == 1);

  return handle;
}

static js_value_t *
bare_crypto_hmac_update(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_crypto_hmac_t *hmac;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &hmac, NULL);
  assert(err == 0);

  void *data;
  err = js_get_arraybuffer_info(env, argv[1], &data, NULL);
  assert(err == 0);

  int64_t offset;
  err = js_get_value_int64(env, argv[2], &offset);
  assert(err == 0);

  int64_t len;
  err = js_get_value_int64(env, argv[3], &len);
  assert(err == 0);

  err = HMAC_Update(&hmac->context, &data[offset], len);
  assert(err == 1);

  return NULL;
}

static js_value_t *
bare_crypto_hmac_final(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_crypto_hmac_t *hmac;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &hmac, NULL);
  assert(err == 0);

  js_value_t *result;

  size_t len = HMAC_size(&hmac->context);

  uint8_t *digest;
  err = js_create_arraybuffer(env, len, (void **) &digest, &result);
  assert(err == 0);

  err = HMAC_Final(&hmac->context, digest, NULL);
  assert(err == 1);

  return result;
}

static js_value_t *
bare_crypto_cipher_key_length(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint32_t type;
  err = js_get_value_uint32(env, argv[0], &type);
  assert(err == 0);

  const EVP_CIPHER *algorithm = bare_crypto__to_cipher(env, type);

  if (algorithm == NULL) return NULL;

  js_value_t *result;
  err = js_create_uint32(env, EVP_CIPHER_key_length(algorithm), &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_crypto_cipher_iv_length(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint32_t type;
  err = js_get_value_uint32(env, argv[0], &type);
  assert(err == 0);

  const EVP_CIPHER *algorithm = bare_crypto__to_cipher(env, type);

  if (algorithm == NULL) return NULL;

  js_value_t *result;
  err = js_create_uint32(env, EVP_CIPHER_iv_length(algorithm), &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_crypto_cipher_block_size(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_crypto_cipher_t *cipher;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &cipher, NULL);
  assert(err == 0);

  js_value_t *result;
  err = js_create_uint32(env, EVP_CIPHER_CTX_block_size(&cipher->context), &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_crypto_cipher_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 8;
  js_value_t *argv[8];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 8);

  uint32_t type;
  err = js_get_value_uint32(env, argv[0], &type);
  assert(err == 0);

  uint8_t *key;
  err = js_get_arraybuffer_info(env, argv[1], (void **) &key, NULL);
  assert(err == 0);

  int64_t key_offset;
  err = js_get_value_int64(env, argv[2], &key_offset);
  assert(err == 0);

  int64_t key_len;
  err = js_get_value_int64(env, argv[3], &key_len);
  assert(err == 0);

  uint8_t *iv;
  err = js_get_arraybuffer_info(env, argv[4], (void **) &iv, NULL);
  assert(err == 0);

  int64_t iv_offset;
  err = js_get_value_int64(env, argv[5], &iv_offset);
  assert(err == 0);

  int64_t iv_len;
  err = js_get_value_int64(env, argv[6], &iv_len);
  assert(err == 0);

  bool encrypt;
  err = js_get_value_bool(env, argv[7], &encrypt);
  assert(err == 0);

  js_value_t *handle;

  bare_crypto_cipher_t *cipher;
  err = js_create_arraybuffer(env, sizeof(bare_crypto_cipher_t), (void **) &cipher, &handle);
  assert(err == 0);

  const EVP_CIPHER *algorithm = bare_crypto__to_cipher(env, type);

  if (algorithm == NULL) return NULL;

  err = EVP_CipherInit(&cipher->context, algorithm, &key[key_offset], &iv[iv_offset], encrypt);
  assert(err == 1);

  return handle;
}

static js_value_t *
bare_crypto_cipher_update(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 5;
  js_value_t *argv[5];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 5);

  bare_crypto_cipher_t *cipher;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &cipher, NULL);
  assert(err == 0);

  uint8_t *data;
  err = js_get_arraybuffer_info(env, argv[1], (void **) &data, NULL);
  assert(err == 0);

  int64_t offset;
  err = js_get_value_int64(env, argv[2], &offset);
  assert(err == 0);

  int64_t len;
  err = js_get_value_int64(env, argv[3], &len);
  assert(err == 0);

  uint8_t *out;
  err = js_get_arraybuffer_info(env, argv[4], (void **) &out, NULL);
  assert(err == 0);

  int written;
  err = EVP_CipherUpdate(&cipher->context, out, &written, &data[offset], len);

  if (err != 1) {
    err = js_throw_error(env, NULL, "Cipher update failed");
    assert(err == 0);

    return NULL;
  }

  js_value_t *result;
  err = js_create_int32(env, written, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_crypto_cipher_final(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_crypto_cipher_t *cipher;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &cipher, NULL);
  assert(err == 0);

  uint8_t *out;
  err = js_get_arraybuffer_info(env, argv[1], (void **) &out, NULL);
  assert(err == 0);

  int written;
  err = EVP_CipherFinal(&cipher->context, out, &written);

  EVP_CIPHER_CTX_cleanup(&cipher->context);

  if (err != 1) {
    err = js_throw_error(env, NULL, "Cipher finalisation failed");
    assert(err == 0);

    return NULL;
  }

  js_value_t *result;
  err = js_create_int32(env, written, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_crypto_cipher_set_padding(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_crypto_cipher_t *cipher;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &cipher, NULL);
  assert(err == 0);

  bool pad;
  err = js_get_value_bool(env, argv[1], &pad);
  assert(err == 0);

  err = EVP_CIPHER_CTX_set_padding(&cipher->context, pad);
  assert(err == 1);

  return NULL;
}

static js_value_t *
bare_crypto_aead_key_length(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint32_t type;
  err = js_get_value_uint32(env, argv[0], &type);
  assert(err == 0);

  const EVP_AEAD *algorithm = bare_crypto__to_aead(env, type);

  if (algorithm == NULL) return NULL;

  js_value_t *result;
  err = js_create_int64(env, EVP_AEAD_key_length(algorithm), &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_crypto_aead_nonce_length(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint32_t type;
  err = js_get_value_uint32(env, argv[0], &type);
  assert(err == 0);

  const EVP_AEAD *algorithm = bare_crypto__to_aead(env, type);

  if (algorithm == NULL) return NULL;

  js_value_t *result;
  err = js_create_int64(env, EVP_AEAD_nonce_length(algorithm), &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_crypto_aead_max_overhead(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_crypto_aead_t *aead;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &aead, NULL);
  assert(err == 0);

  js_value_t *result;
  err = js_create_int64(env, EVP_AEAD_max_overhead(EVP_AEAD_CTX_aead(&aead->context)), &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_crypto_aead_max_tag_length(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_crypto_aead_t *aead;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &aead, NULL);
  assert(err == 0);

  js_value_t *result;
  err = js_create_int64(env, EVP_AEAD_max_tag_len(EVP_AEAD_CTX_aead(&aead->context)), &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_crypto_aead_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 5;
  js_value_t *argv[5];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 5);

  uint32_t type;
  err = js_get_value_uint32(env, argv[0], &type);
  assert(err == 0);

  uint8_t *key;
  err = js_get_arraybuffer_info(env, argv[1], (void **) &key, NULL);
  assert(err == 0);

  int64_t key_offset;
  err = js_get_value_int64(env, argv[2], &key_offset);
  assert(err == 0);

  int64_t key_len;
  err = js_get_value_int64(env, argv[3], &key_len);
  assert(err == 0);

  int64_t tag_len;
  err = js_get_value_int64(env, argv[4], &tag_len);
  assert(err == 0);

  js_value_t *handle;

  bare_crypto_aead_t *aead;
  err = js_create_arraybuffer(env, sizeof(bare_crypto_aead_t), (void **) &aead, &handle);
  assert(err == 0);

  const EVP_AEAD *algorithm = bare_crypto__to_aead(env, type);

  if (algorithm == NULL) return NULL;

  err = EVP_AEAD_CTX_init(&aead->context, algorithm, &key[key_offset], key_len, tag_len, NULL);
  assert(err == 1);

  return handle;
}

static js_value_t *
bare_crypto_aead_seal(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 11;
  js_value_t *argv[11];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 11);

  bare_crypto_aead_t *aead;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &aead, NULL);
  assert(err == 0);

  uint8_t *data;
  err = js_get_arraybuffer_info(env, argv[1], (void **) &data, NULL);
  assert(err == 0);

  int64_t data_offset;
  err = js_get_value_int64(env, argv[2], &data_offset);
  assert(err == 0);

  int64_t data_len;
  err = js_get_value_int64(env, argv[3], &data_len);
  assert(err == 0);

  uint8_t *nonce;
  err = js_get_arraybuffer_info(env, argv[4], (void **) &nonce, NULL);
  assert(err == 0);

  int64_t nonce_offset;
  err = js_get_value_int64(env, argv[5], &nonce_offset);
  assert(err == 0);

  int64_t nonce_len;
  err = js_get_value_int64(env, argv[6], &nonce_len);
  assert(err == 0);

  uint8_t *ad;
  err = js_get_arraybuffer_info(env, argv[7], (void **) &ad, NULL);
  assert(err == 0);

  int64_t ad_offset;
  err = js_get_value_int64(env, argv[8], &ad_offset);
  assert(err == 0);

  int64_t ad_len;
  err = js_get_value_int64(env, argv[9], &ad_len);
  assert(err == 0);

  size_t out_len;
  uint8_t *out;
  err = js_get_arraybuffer_info(env, argv[10], (void **) &out, &out_len);
  assert(err == 0);

  size_t written;
  err = EVP_AEAD_CTX_seal(
    &aead->context,
    out,
    &written,
    out_len,
    &nonce[nonce_offset],
    nonce_len,
    &data[data_offset],
    data_len,
    ad_len ? &ad[ad_offset] : NULL,
    ad_len
  );

  EVP_AEAD_CTX_cleanup(&aead->context);

  if (err != 1) {
    err = js_throw_error(env, NULL, "Encryption failed");
    assert(err == 0);
  }

  return NULL;
}

static js_value_t *
bare_crypto_aead_open(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 11;
  js_value_t *argv[11];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 11);

  bare_crypto_aead_t *aead;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &aead, NULL);
  assert(err == 0);

  uint8_t *data;
  err = js_get_arraybuffer_info(env, argv[1], (void **) &data, NULL);
  assert(err == 0);

  int64_t data_offset;
  err = js_get_value_int64(env, argv[2], &data_offset);
  assert(err == 0);

  int64_t data_len;
  err = js_get_value_int64(env, argv[3], &data_len);
  assert(err == 0);

  uint8_t *nonce;
  err = js_get_arraybuffer_info(env, argv[4], (void **) &nonce, NULL);
  assert(err == 0);

  int64_t nonce_offset;
  err = js_get_value_int64(env, argv[5], &nonce_offset);
  assert(err == 0);

  int64_t nonce_len;
  err = js_get_value_int64(env, argv[6], &nonce_len);
  assert(err == 0);

  uint8_t *ad;
  err = js_get_arraybuffer_info(env, argv[7], (void **) &ad, NULL);
  assert(err == 0);

  int64_t ad_offset;
  err = js_get_value_int64(env, argv[8], &ad_offset);
  assert(err == 0);

  int64_t ad_len;
  err = js_get_value_int64(env, argv[9], &ad_len);
  assert(err == 0);

  size_t out_len;
  uint8_t *out;
  err = js_get_arraybuffer_info(env, argv[10], (void **) &out, &out_len);
  assert(err == 0);

  size_t written;
  err = EVP_AEAD_CTX_open(
    &aead->context,
    out,
    &written,
    out_len,
    &nonce[nonce_offset],
    nonce_len,
    &data[data_offset],
    data_len,
    ad_len ? &ad[ad_offset] : NULL,
    ad_len
  );

  EVP_AEAD_CTX_cleanup(&aead->context);

  if (err != 1) {
    err = js_throw_error(env, NULL, "Decryption failed");
    assert(err == 0);
  }

  return NULL;
}

static js_value_t *
bare_crypto_ed25519_generate_keypair(js_env_t *env, js_callback_info_t *info) {
  int err;

  js_value_t *result;
  err = js_create_object(env, &result);
  assert(err == 0);

  js_value_t *handle;

  uint8_t *public_key;
  err = js_create_arraybuffer(env, ED25519_PUBLIC_KEY_LEN, (void **) &public_key, &handle);
  assert(err == 0);

  err = js_set_named_property(env, result, "publicKey", handle);
  assert(err == 0);

  uint8_t *private_key;
  err = js_create_arraybuffer(env, ED25519_PRIVATE_KEY_LEN, (void **) &private_key, &handle);
  assert(err == 0);

  err = js_set_named_property(env, result, "privateKey", handle);
  assert(err == 0);

  ED25519_keypair(public_key, private_key);

  return result;
}

static js_value_t *
bare_crypto_ed25519_sign(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  uint8_t *data;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &data, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[1], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[2], &len);
  assert(err == 0);

  uint8_t *private_key;
  err = js_get_arraybuffer_info(env, argv[3], (void **) &private_key, NULL);
  assert(err == 0);

  js_value_t *handle;

  uint8_t *signature;
  err = js_create_arraybuffer(env, ED25519_SIGNATURE_LEN, (void **) &signature, &handle);
  assert(err == 0);

  err = ED25519_sign(signature, &data[offset], len, private_key);
  assert(err == 1);

  return handle;
}

static js_value_t *
bare_crypto_ed25519_verify(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 6;
  js_value_t *argv[6];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 6);

  uint8_t *data;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &data, NULL);
  assert(err == 0);

  uint32_t data_offset;
  err = js_get_value_uint32(env, argv[1], &data_offset);
  assert(err == 0);

  uint32_t data_len;
  err = js_get_value_uint32(env, argv[2], &data_len);
  assert(err == 0);

  uint8_t *signature;
  err = js_get_arraybuffer_info(env, argv[3], (void **) &signature, NULL);
  assert(err == 0);

  uint32_t signature_offset;
  err = js_get_value_uint32(env, argv[4], &signature_offset);
  assert(err == 0);

  uint8_t *public_key;
  err = js_get_arraybuffer_info(env, argv[5], (void **) &public_key, NULL);
  assert(err == 0);

  js_value_t *result;
  err = js_get_boolean(env, ED25519_verify(&data[data_offset], data_len, &signature[signature_offset], public_key), &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_crypto_ed25519_to_spki(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint8_t *public_key;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &public_key, NULL);
  assert(err == 0);

  EVP_PKEY *pkey = EVP_PKEY_new_raw_public_key(EVP_PKEY_ED25519, NULL, public_key, 32);

  CBB bytes;
  err = CBB_init(&bytes, 0);
  assert(err == 1);

  err = EVP_marshal_public_key(&bytes, pkey);
  assert(err == 1);

  EVP_PKEY_free(pkey);

  uint8_t *der;
  size_t len;
  err = CBB_finish(&bytes, &der, &len);
  assert(err == 1);

  js_value_t *handle;

  void *data;
  err = js_create_arraybuffer(env, len, &data, &handle);
  assert(err == 0);

  memcpy(data, der, len);

  OPENSSL_free(der);

  return handle;
}

static js_value_t *
bare_crypto_ed25519_from_spki(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  uint8_t *der;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &der, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[1], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[2], &len);
  assert(err == 0);

  CBS bytes;
  CBS_init(&bytes, &der[offset], len);

  EVP_PKEY *pkey = EVP_parse_public_key(&bytes);

  if (pkey == NULL) {
    err = js_throw_error(env, NULL, "Invalid input");
    assert(err == 0);

    return NULL;
  }

  js_value_t *handle;

  uint8_t *public_key;
  err = js_create_arraybuffer(env, ED25519_PUBLIC_KEY_LEN, (void **) &public_key, &handle);
  assert(err == 0);

  size_t written = ED25519_PUBLIC_KEY_LEN;
  err = EVP_PKEY_get_raw_public_key(pkey, public_key, &written);

  EVP_PKEY_free(pkey);

  if (err != 1) {
    err = js_throw_error(env, NULL, "Invalid input");
    assert(err == 0);

    return NULL;
  }

  return handle;
}

static js_value_t *
bare_crypto_ed25519_to_pkcs8(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint8_t *private_key;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &private_key, NULL);
  assert(err == 0);

  EVP_PKEY *pkey = EVP_PKEY_new_raw_private_key(EVP_PKEY_ED25519, NULL, private_key, 32);

  CBB bytes;
  err = CBB_init(&bytes, 0);
  assert(err == 1);

  err = EVP_marshal_private_key(&bytes, pkey);
  assert(err == 1);

  EVP_PKEY_free(pkey);

  uint8_t *der;
  size_t len;
  err = CBB_finish(&bytes, &der, &len);
  assert(err == 1);

  js_value_t *handle;

  void *data;
  err = js_create_arraybuffer(env, len, &data, &handle);
  assert(err == 0);

  memcpy(data, der, len);

  OPENSSL_free(der);

  return handle;
}

static js_value_t *
bare_crypto_ed25519_from_pkcs8(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  uint8_t *der;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &der, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[1], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[2], &len);
  assert(err == 0);

  CBS bytes;
  CBS_init(&bytes, &der[offset], len);

  EVP_PKEY *pkey = EVP_parse_private_key(&bytes);

  if (pkey == NULL) {
    err = js_throw_error(env, NULL, "Invalid input");
    assert(err == 0);

    return NULL;
  }

  js_value_t *handle;

  uint8_t *private_key;
  err = js_create_arraybuffer(env, ED25519_PRIVATE_KEY_LEN, (void **) &private_key, &handle);
  assert(err == 0);

  size_t written = ED25519_PRIVATE_KEY_LEN;
  err = EVP_PKEY_get_raw_private_key(pkey, private_key, &written);

  EVP_PKEY_free(pkey);

  if (err != 1) {
    err = js_throw_error(env, NULL, "Invalid input");
    assert(err == 0);

    return NULL;
  }

  return handle;
}

static js_value_t *
bare_crypto_random_fill(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  uint8_t *data;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &data, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[1], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[2], &len);
  assert(err == 0);

  err = RAND_bytes(&data[offset], len);
  assert(err == 1);

  return NULL;
}

static js_value_t *
bare_crypto_pbkdf2(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 9;
  js_value_t *argv[9];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 9);

  char *password;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &password, NULL);
  assert(err == 0);

  int64_t password_offset;
  err = js_get_value_int64(env, argv[1], &password_offset);
  assert(err == 0);

  int64_t password_len;
  err = js_get_value_int64(env, argv[2], &password_len);
  assert(err == 0);

  uint8_t *salt;
  err = js_get_arraybuffer_info(env, argv[3], (void **) &salt, NULL);
  assert(err == 0);

  int64_t salt_offset;
  err = js_get_value_int64(env, argv[4], &salt_offset);
  assert(err == 0);

  int64_t salt_len;
  err = js_get_value_int64(env, argv[5], &salt_len);
  assert(err == 0);

  uint32_t iterations;
  err = js_get_value_uint32(env, argv[6], &iterations);
  assert(err == 0);

  uint32_t type;
  err = js_get_value_uint32(env, argv[7], &type);
  assert(err == 0);

  int64_t key_len;
  err = js_get_value_int64(env, argv[8], &key_len);
  assert(err == 0);

  js_value_t *handle;

  uint8_t *out;
  err = js_create_arraybuffer(env, key_len, (void **) &out, &handle);
  assert(err == 0);

  const EVP_MD *algorithm = bare_crypto__to_hash(env, type);

  if (algorithm == NULL) return NULL;

  err = PKCS5_PBKDF2_HMAC(&password[password_offset], password_len, &salt[salt_offset], salt_len, iterations, algorithm, key_len, out);
  assert(err == 1);

  return handle;
}

static js_value_t *
bare_crypto_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("hashInit", bare_crypto_hash_init)
  V("hashUpdate", bare_crypto_hash_update)
  V("hashFinal", bare_crypto_hash_final)

  V("hmacInit", bare_crypto_hmac_init)
  V("hmacUpdate", bare_crypto_hmac_update)
  V("hmacFinal", bare_crypto_hmac_final)

  V("cipherKeyLength", bare_crypto_cipher_key_length)
  V("cipherIVLength", bare_crypto_cipher_iv_length)
  V("cipherBlockSize", bare_crypto_cipher_block_size)
  V("cipherInit", bare_crypto_cipher_init)
  V("cipherUpdate", bare_crypto_cipher_update)
  V("cipherFinal", bare_crypto_cipher_final)
  V("cipherSetPadding", bare_crypto_cipher_set_padding)

  V("aeadKeyLength", bare_crypto_aead_key_length)
  V("aeadNonceLength", bare_crypto_aead_nonce_length)
  V("aeadMaxOverhead", bare_crypto_aead_max_overhead)
  V("aeadMaxTagLength", bare_crypto_aead_max_tag_length)
  V("aeadInit", bare_crypto_aead_init)
  V("aeadSeal", bare_crypto_aead_seal)
  V("aeadOpen", bare_crypto_aead_open)

  V("ed25519GenerateKeypair", bare_crypto_ed25519_generate_keypair)
  V("ed25519Sign", bare_crypto_ed25519_sign)
  V("ed25519Verify", bare_crypto_ed25519_verify)
  V("ed25519ToSPKI", bare_crypto_ed25519_to_spki)
  V("ed25519FromSPKI", bare_crypto_ed25519_from_spki)
  V("ed25519ToPKCS8", bare_crypto_ed25519_to_pkcs8)
  V("ed25519FromPKCS8", bare_crypto_ed25519_from_pkcs8)

  V("randomFill", bare_crypto_random_fill)

  V("pbkdf2", bare_crypto_pbkdf2);
#undef V

#define V(name, n) \
  { \
    js_value_t *val; \
    err = js_create_uint32(env, n, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  // Hash algorithms
  V("MD5", bare_crypto_md5)
  V("SHA1", bare_crypto_sha1)
  V("SHA256", bare_crypto_sha256)
  V("SHA512", bare_crypto_sha512)
  V("BLAKE2B256", bare_crypto_blake2b256)

  // Cipher algorithms
  V("AES128ECB", bare_crypto_aes_128_ecb)
  V("AES128CBC", bare_crypto_aes_128_cbc)
  V("AES128CTR", bare_crypto_aes_128_ctr)
  V("AES128OFB", bare_crypto_aes_128_ofb)
  V("AES256ECB", bare_crypto_aes_256_ecb)
  V("AES256CBC", bare_crypto_aes_256_cbc)
  V("AES256CTR", bare_crypto_aes_256_ctr)
  V("AES256OFB", bare_crypto_aes_256_ofb)
  V("AES128GCM", bare_crypto_aes_128_gcm)
  V("AES256GCM", bare_crypto_aes_256_gcm)
  V("CHACHA20POLY1305", bare_crypto_chacha20_poly1305)
  V("XCHACHA20POLY1305", bare_crypto_xchacha20_poly1305)

  // Signature algorithms
  V("ED25519", bare_crypto_ed25519)
#undef V

  return exports;
}

BARE_MODULE(bare_crypto, bare_crypto_exports)
