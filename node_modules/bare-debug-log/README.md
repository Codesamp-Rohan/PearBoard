# bare-debug-log

Simple debug log for JavaScript.

```
npm i bare-debug-log
```

## Usage

```js
const log = require('bare-debug-log')('foo')

log('hello from foo [%d]', 123)
```

```sh
$ BARE_DEBUG=foo bare index.js
FOO 3245: hello from foo [123]
```

## License

Apache-2.0
