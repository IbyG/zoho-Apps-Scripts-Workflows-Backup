require('dotenv').config();

(async () => {
  const { writeCrmFunctionsToFilesystem } = await import('./fetchAllFunctionsCore.mjs');
  await writeCrmFunctionsToFilesystem({
    xCrmOrg: process.env.XCRMORG,
    xZcsrfToken: process.env.XZCSRFTOKEN,
    cookie: process.env.COOKIE,
  });
})();
