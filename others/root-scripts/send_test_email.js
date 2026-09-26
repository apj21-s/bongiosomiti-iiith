require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { sendRegistrationPendingEmail } = require('./utils/email.ts'); // Wait, require won't work on TS directly without compilation.
