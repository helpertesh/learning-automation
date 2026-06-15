const usePostgres = !!process.env.DATABASE_URL?.trim();
const driver = usePostgres ? require('./postgres') : require('./sqlite');

async function init() {
  await driver.init();
}

function prepare(sql) {
  return driver.prepare(sql);
}

function exec(sql) {
  return driver.exec(sql);
}

function getEngine() {
  return driver.getEngine();
}

module.exports = { init, prepare, exec, getEngine };
