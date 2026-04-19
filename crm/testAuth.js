require('dotenv').config();

(async () => {
  const { validateCrmSession } = await import('./validateCrmSession.mjs');
  try {
    await validateCrmSession({
      xCrmOrg: process.env.XCRMORG,
      xZcsrfToken: process.env.XZCSRFTOKEN,
      cookie: process.env.COOKIE,
    });
    console.log('Authentication Successful');
  } catch (err) {
    console.log('Authentication Failed', err.detail != null ? err.detail : err.message);
  }
})();
