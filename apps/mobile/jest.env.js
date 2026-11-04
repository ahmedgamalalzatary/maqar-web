// Runs before the test framework loads: tests read the root .env.test, never .env.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.test'), override: true, quiet: true });
