# bare-https

HTTPS library for JavaScript.

```
npm i bare-https
```

## Usage

```js
const https = require('bare-https')

const options = {
  cert: fs.readFileSync('test/fixtures/cert.crt'),
  key: fs.readFileSync('test/fixtures/cert.key')
}

const server = https.createServer(options, (req, res) => {
  res.statusCode = 200
  res.setHeader('Content-Length', 10)
  res.write('hello world!')
  res.end()
})

server.listen(0, () => {
  const { port } = server.address()
  console.log('server is bound on', port)

  const client = https.request({ port }, (res) => {
    res.on('data', (data) => console.log(data.toString()))
  })
  client.end()
})
```

## License

Apache-2.0
