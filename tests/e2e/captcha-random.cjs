// Injected only into the isolated Playwright Next process. No application bypass.
// This makes image answers predictable while exercising real server validation.
const crypto = require('node:crypto');
crypto.randomInt = (min, max) => max === undefined ? 0 : min;
require('node:module').syncBuiltinESMExports();
