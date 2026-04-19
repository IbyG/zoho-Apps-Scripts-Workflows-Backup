require('dotenv').config();

(async () => {
  const { writeBooksFunctionsToFilesystem } = await import('./fetchAllFunctionsCore.mjs');
  await writeBooksFunctionsToFilesystem({
    xCrmOrg: process.env.XCRMORG,
    xZcsrfToken: process.env.XZCSRFTOKEN,
    cookie: process.env.COOKIE,
  });
})();
