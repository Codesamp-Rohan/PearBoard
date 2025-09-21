# bare-crypto

Cryptographic primitives for JavaScript.

```
npm i bare-crypto
```

## Usage

```js
const crypto = require('bare-crypto')

const hash = crypto.createHash('sha256')

hash.update('Hello, world!')

const digest = hash.digest('hex')

console.log(digest)
```

## API

#### `const hash = createHash(algorithm[, options])`

Create a new `Hash` instance with the specified algorithm and options. The options are passed to [`new Transform()`](https://github.com/mafintosh/streamx#ts--new-streamtransformoptions).

#### `const hmac = createHmac(algorithm, key[, options])`

Create a new `Hmac` instance with the specified algorithm, key, and options. The options are passed to [`new Transform()`](https://github.com/mafintosh/streamx#ts--new-streamtransformoptions).

#### `const cipher = createCipheriv(algorithm, key, iv[, options])`

Create a new `Cipheriv` instance using the specified algorithm, key, and initialization vector (`iv`). The options are passed to [`new Transform()`](https://github.com/mafintosh/streamx#ts--new-streamtransformoptions).

#### `const decipher = createDecipheriv(algorithm, key, iv[, options])`

Create a new `Decipheriv` instance using the specified algorithm, key, and initialization vector (`iv`). The options are passed to [`new Transform()`](https://github.com/mafintosh/streamx#ts--new-streamtransformoptions).

#### `const buffer = randomBytes(size)`

Generate cryptographically secure random bytes.

#### `randomBytes(size, callback)`

Generate cryptographically secure random bytes. The callback signature is `callback(err, buffer)`.

#### `buffer = randomFill(buffer[, offset][, size])`

Fill a buffer with cryptographically secure random bytes.

#### `randomFill(buffer[, offset][, size], callback)`

Fill a buffer with cryptographically secure random bytes. The callback signature is `callback(err, buffer)`

#### `const buffer = pbkdf2(password, salt, iterations, keylen, digest)`

Derive a key from a password and salt using the specified digest algorithm and number of iterations.

#### `pbkdf2(password, salt, iterations, keylen, digest, callback)`

Derive a key from a password and salt using the specified digest algorithm and number of iterations. The callback signature is `callback(err, buffer)`.

#### `constants.hash`

The supported hash algorithms.

| Constant     | Description                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MD5`        | A widely-used 128-bit hash function, now considered insecure due to vulnerabilities to collision attacks. Still fast but not recommended for security-sensitive purposes.             |
| `SHA1`       | A 160-bit hash function, stronger than MD5 but also broken by collision attacks. Deprecated for most cryptographic uses due to security vulnerabilities.                              |
| `SHA256`     | Part of the SHA-2 family, this 256-bit hash function is widely used and considered secure for most applications. Slower than MD5 and SHA1 but much more secure.                       |
| `SHA512`     | Another member of the SHA-2 family, this 512-bit hash function offers greater security than SHA256 but is slower and produces larger hashes. Suitable for high-security environments. |
| `BLAKE2B256` | A fast, secure alternative to SHA-2 designed for efficiency, producing a 256-bit hash. It is optimized for performance while maintaining strong cryptographic security.               |

#### `constants.cipher`

The supported symmetric cipher algorithms.

| Constant            | Description                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AES128ECB`         | AES with a 128-bit key in ECB (Electronic Codebook) mode. Fast but insecure due to deterministic encryption of identical plaintext blocks. Not recommended.  |
| `AES128CBC`         | AES with a 128-bit key in CBC (Cipher Block Chaining) mode. Provides better security than ECB by chaining blocks, but requires an IV and is slower.          |
| `AES128CTR`         | AES with a 128-bit key in CTR (Counter) mode. A secure and parallelizable mode that turns a block cipher into a stream cipher. Requires a nonce/IV.          |
| `AES128OFB`         | AES with a 128-bit key in OFB (Output Feedback) mode. Converts AES into a stream cipher; less common than CTR and more sensitive to IV reuse.                |
| `AES256ECB`         | AES with a 256-bit key in ECB mode. Inherits the weaknesses of ECB; not suitable for encrypting more than a block at a time securely.                        |
| `AES256CBC`         | AES with a 256-bit key in CBC mode. Commonly used and reasonably secure with proper IV and padding management.                                               |
| `AES256CTR`         | AES with a 256-bit key in CTR mode. Offers high performance and strong security if nonces are never reused.                                                  |
| `AES256OFB`         | AES with a 256-bit key in OFB mode. Like CTR, it turns AES into a stream cipher but with different feedback mechanics; less commonly used.                   |
| `AES128GCM`         | AES with a 128-bit key in GCM (Galois/Counter Mode). Provides authenticated encryption with associated data (AEAD). Fast and secure with proper nonce usage. |
| `AES256GCM`         | AES with a 256-bit key in GCM mode. Offers strong authenticated encryption; commonly used in TLS and secure messaging.                                       |
| `CHACHA20POLY1305`  | A modern AEAD cipher combining the ChaCha20 stream cipher and Poly1305 MAC. Fast and secure, especially efficient on devices without AES hardware support.   |
| `XCHACHA20POLY1305` | An extended variant of ChaCha20-Poly1305 that supports longer nonces (192-bit). Improves nonce reuse resistance and is easier to use safely.                 |

## License

Apache-2.0
