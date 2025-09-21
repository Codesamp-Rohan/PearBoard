const encoding = require('.')

global.TextDecoder = encoding.TextDecoder
global.TextEncoder = encoding.TextEncoder
