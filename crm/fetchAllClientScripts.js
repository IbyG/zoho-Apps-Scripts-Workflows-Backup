require('dotenv').config();

(async () => {
  const { writeCrmClientScriptsToFilesystem } = await import(
    './fetchAllClientScriptsCore.mjs'
  );
  await writeCrmClientScriptsToFilesystem({
    xCrmOrg: process.env.XCRMORG,
    xZcsrfToken: process.env.XZCSRFTOKEN,
    cookie: process.env.COOKIE,
  });
})();
