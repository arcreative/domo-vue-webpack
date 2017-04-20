require('./check-versions')()

var config = require('../config')
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = JSON.parse(config.dev.env.NODE_ENV)
}

var opn = require('opn')
var path = require('path')
var express = require('express')
var webpack = require('webpack')
var proxyMiddleware = require('http-proxy-middleware')
var webpackConfig = {{#if_or unit e2e}}process.env.NODE_ENV === 'testing'
  ? require('./webpack.prod.conf')
  : {{/if_or}}require('./webpack.dev.conf')

// default port where dev server listens for incoming traffic
var port = process.env.PORT || config.dev.port
// automatically open browser, if not set will be false
var autoOpenBrowser = !!config.dev.autoOpenBrowser
// Define HTTP proxies to your custom API backend
// https://github.com/chimurai/http-proxy-middleware
var proxyTable = config.dev.proxyTable

var app = express()
var compiler = webpack(webpackConfig)

var devMiddleware = require('webpack-dev-middleware')(compiler, {
  publicPath: webpackConfig.output.publicPath,
  quiet: true
})

var hotMiddleware = require('webpack-hot-middleware')(compiler, {
  log: () => {}
})
// force page reload when html-webpack-plugin template changes
compiler.plugin('compilation', function (compilation) {
  compilation.plugin('html-webpack-plugin-after-emit', function (data, cb) {
    hotMiddleware.publish({ action: 'reload' })
    cb()
  })
})


/////////////////
// START DOMO
/////////////////
  const bodyParser = require('body-parser');
  const domoHelpers = require('./domo/helpers');
  const request = require('request');

// Verify active Domo session
  domoHelpers.checkSession()
    .then(function() {
      console.log('Domo session is active.');
    }, function() {
      console.error('Domo session isn\'t active, please use `domo login` to restart your session');
      process.exit(1);
    })

  app.use(bodyParser.urlencoded({
    extended: false
  }));
  app.use(bodyParser.json());
  app.all('/data/v1/:query', function(req, res) {
    console.log('Proxying request', req.path, 'to Domo server.');
    domoHelpers.domainPromise
      .then(function(context) {
        const url = domoHelpers.info.baseUrl + req.url;
        const j = request.jar();

        const referer = (req.headers.referer || '').indexOf('?') >= 0 ? `${req.headers.referer}&context=${context.id}` : `${req.headers.referer}?userId=27&customer=dev&locale=en-US&platform=desktop&context=${context.id}`; // jshint ignore:line
        const headers = Object.assign({
          referer,
          accept: req.headers.accept,
          'content-type': req.headers['content-type'] || req.headers['Content-Type']
        }, domoHelpers.domoInstance.getAuthHeader());

        const r = request({
          url,
          method: req.method,
          headers,
          jar: j,
          body: JSON.stringify(req.body)
        });

        r.pipe(res);
      })
      .catch(function(err) {
        console.warn(err);
      });
  });
/////////////////
// END DOMO
/////////////////


// proxy api requests
Object.keys(proxyTable).forEach(function (context) {
  var options = proxyTable[context]
  if (typeof options === 'string') {
    options = { target: options }
  }
  app.use(proxyMiddleware(options.filter || context, options))
})

// handle fallback for HTML5 history API
app.use(require('connect-history-api-fallback')())

// serve webpack bundle output
app.use(devMiddleware)

// enable hot-reload and state-preserving
// compilation error display
app.use(hotMiddleware)

// serve pure static assets
var staticPath = path.posix.join(config.dev.assetsPublicPath, config.dev.assetsSubDirectory)
app.use(staticPath, express.static('./static'))

var uri = 'http://localhost:' + port

var _resolve
var readyPromise = new Promise(resolve => {
  _resolve = resolve
})

console.log('> Starting dev server...')
devMiddleware.waitUntilValid(() => {
  console.log('> Listening at ' + uri + '\n')
  // when env is testing, don't need open it
  if (autoOpenBrowser && process.env.NODE_ENV !== 'testing') {
    opn(uri)
  }
  _resolve()
})

var server = app.listen(port)

module.exports = {
  ready: readyPromise,
  close: () => {
    server.close()
  }
}
