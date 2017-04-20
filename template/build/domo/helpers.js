const path = require('path');
const fs = require('fs-extra');
const glob = require('glob');
const request = require('request');
const Domo = require('ryuu-client');

let info = {
  baseUrl: null,
};
const home = Domo.getHomeDir();
const mostRecent = getMostRecentLogin();
const domoInstance = new Domo(mostRecent.instance, mostRecent.sid, mostRecent.devtoken);
const manifest = fs.readJsonSync(path.resolve(process.cwd() + '/domo/manifest.json'));
const domainPromise = getDomoappsDomain()
  .then(function(baseUrl) {
    info.baseUrl = baseUrl;
  })
  .then(function() {
    return createContext(manifest.id, manifest.mapping);
  });

function getMostRecentLogin() {
  const logins = glob.sync(`${home}/login/*.json`);
  if (logins.length === 0) {
    return null;
  }

  const mostRecentLogin = logins.reduce(function(prev, next) {
    return fs.statSync(prev).mtime > fs.statSync(next).mtime ? prev : next;
  });
  return fs.readJsonSync(mostRecentLogin);
}

function getEnv() {
  const regexp = /([-_\w]+)\.(.*)/;
  return mostRecent.instance.match(regexp)[2];
}

function getDomoappsDomain() {
  const uuid = Domo.createUUID();
  return new Promise(function(resolve) {
    request({
      url: `https://${mostRecent.instance}/api/content/v1/mobile/environment`,
      headers: domoInstance.getAuthHeader()
    }, function(err, res) {
      if (res.statusCode === 200) {
        resolve(`https://${uuid}.${JSON.parse(res.body).domoappsDomain}`);
      } else {
        resolve(`https://${uuid}.domoapps.${getEnv()}`);
      }
    });
  });
}

function createContext(designId, mapping) {
  return new Promise(function(resolve) {
    const options = {
      url: `https://${mostRecent.instance}/domoapps/apps/v2/contexts`,
      method: 'POST',
      json: {
        designId,
        mapping
      },
      headers: domoInstance.getAuthHeader()
    };

    request(options, function(err, res) {
      resolve(res.body[0] ? res.body[0] : {
        id: 0
      });
    });
  });
}

function checkSession() {
  return new Promise(function(resolve, reject) {
    if (typeof mostRecent.devtoken !== 'undefined') {
      // we don't have any way to check tokens, so we'll default to accent
      // until this is fixed
      resolve(true);
    }
    const options = {
      url: `https://${mostRecent.instance}/auth/validate`,
      method: 'GET',
      headers: {
        'X-Domo-Authentication': mostRecent.sid
      }
    };

    request(options, function(err, res) {
      try {
        const isValid = JSON.parse(res.body)
          .isValid;
        if (isValid) {
          resolve(true);
        } else {
          reject('Session expired. Please login again using domo login.');
        }
      } catch (e) {
        // couldn't parse as JSON which means the service doesn't exist yet.
        // TODO: remove this once the /domoweb/auth/validate service has shipped to prod
        resolve(true);
      }
    });
  });
}

module.exports = {
  info: info,
  checkSession: checkSession,
  domainPromise: domainPromise,
  domoInstance: domoInstance
  // getMostRecentLogin: getMostRecentLogin,
  // getCustomer: getCustomer,
  // getEnv: getEnv,
  // getDomoappsDomain: getDomoappsDomain,
  // createContext: createContext,
  // checkSession: checkSession,
};
