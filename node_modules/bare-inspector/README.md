# bare-inspector

V8 inspector support for Bare.

```
npm i bare-inspector
```

## Usage

```js
const { Session } = require('bare-inspector')

const session = new Session()
session.connect()

try {
  const { result } = await session.post('Runtime.evaluate', {
    expression: '1 + 2'
  })

  console.log(result)
} catch (err) {
  console.error(err)
}
```

### Heap snapshots

```js
const { Session, HeapSnapshot } = require('bare-inspector')
const fs = require('bare-fs')

const session = new Session()
session.connect()

const snapshot = new HeapSnapshot(session)

snapshot.pipe(fs.createWriteStream('profile.heapsnapshot'))
```

## API

#### `const session = new Session()`

#### `session.connect()`

#### `session.post()`

#### `session.destroy()`

#### `session.on('<inspector-protocol-method>', message)`

#### `session.on('inspectorNotification', message)`

#### `const snapshot = new HeapSnapshot(session)`

#### `for await (const chunk of snapshot)`

## License

Apache-2.0
