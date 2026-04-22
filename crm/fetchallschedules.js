require('dotenv').config();

(async () => {
  const { writeCrmSchedulesToFilesystem } = await import(
    './fetchallschedulescore.mjs'
  );
  await writeCrmSchedulesToFilesystem({
    xCrmOrg: process.env.XCRMORG,
    xZcsrfToken: process.env.XZCSRFTOKEN,
    cookie: process.env.COOKIE,
  });
})();
