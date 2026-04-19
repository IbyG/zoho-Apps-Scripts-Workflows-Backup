require('dotenv').config();

(async () => {
  const { writeCrmWorkflowsToFilesystem } = await import(
    './fetchAllWorkflowsCore.mjs'
  );
  await writeCrmWorkflowsToFilesystem({
    xCrmOrg: process.env.XCRMORG,
    xZcsrfToken: process.env.XZCSRFTOKEN,
    cookie: process.env.COOKIE,
  });
})();
