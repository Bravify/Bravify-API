var restify = require('restify');
var path = require('path');
var mkdir = require('mkdirp');
var rimraf = require('rimraf');
var Promise = require('bluebird');
var dns = require('dns');
var url = require('url');
var fs = Promise.promisifyAll(require('graceful-fs'));
var EventEmitter = require('events');
var util = require('util');
Promise.promisifyAll(restify.JsonClient.prototype, {multiArgs: true});

function DataLoader(opts) {
  EventEmitter.call(this);
  this.opts = opts;
  this.originalHost = opts.url;
  var self = this;

  this.dnsLookup(this.opts, this.originalHost).then(host => {
    self.opts.url = host;
    self.opts.headers = {
      'Host': url.parse(self.originalHost).hostname
    };
    self.JSONClient = restify.createJsonClient(self.opts);
  }).then(() => {
    self.emit('ready');
  });

  setInterval(() => {
    this.dnsLookup(this.opts, this.originalHost).then(host => {
      self.opts.url = host;
      self.opts.headers = {
        'Host': url.parse(self.originalHost).hostname
      };
      self.JSONClient = restify.createJsonClient(self.opts);
    });
  }, 10800000); // run every 3 hours.

  this.log = opts.log.child({module: 'DataLoader'});
}

util.inherits(DataLoader, EventEmitter);

DataLoader.prototype.dnsLookup = function (opts) {
  return new Promise((res, rej) => {
    var host = opts.url;
    var hostname = url.parse(opts.url).hostname;
    var proto = url.parse(opts.url).protocol;

    dns.lookup(hostname, 4, (e, a) => {
      if(e) {return rej(e);}
      return res(`${proto}//${a}`);
    });
  });
};

DataLoader.prototype.loadFromCache = function (item, version) {
  var file = path.resolve('cache', version, `${item}.json`);
  this.log.trace(`Attempting to load ${file}.`);
  return fs.readFileAsync(file, 'utf8').then(d => {
    this.log.trace(`${file} loaded.`);
    return JSON.parse(d);
  });
};

DataLoader.prototype.saveToCache = function (item, version, data) {
  //mkdirp first, just in case.
  var filePath = path.resolve('cache', version, `${item}`);
  mkdir(path.dirname(filePath), e => {
    if(e) { this.log.error(e, `couldn't create folder ${path.dirname(filePath)}. expect terrible things ahead!`); }
    fs.writeFileSync(filePath + '.json', JSON.stringify(data, null, 2));
  });
};

DataLoader.prototype.clearCache = function () {
  rimraf.sync(path.resolve('cache'));
  mkdir.sync(path.resolve('cache'));
};

DataLoader.prototype.getRealmAndLangListData = function (region) {
  var log = this.log;
  var JSONClient = this.JSONClient;
  return new Promise((res, rej) => {
    if(!JSONClient) {
      log.error(`Can't load data, no JSONClient loaded!`);
      return rej();
    }

    log.debug(`Downloading /realms/${region}.json`);
    JSONClient.getAsync(`/realms/${region}.json`).spread((req, resp, obj) => {
      log.debug(`/realms/${region}.json downloaded.`);
      return obj;
    }).then(d => {
      log.debug(`Downloading /cdn/languages.json`);
      JSONClient.getAsync(`/cdn/languages.json`).spread((req, resp, obj) => {
        log.debug(`/cdn/languages.json downloaded.`);
        res({version: d, lang: obj});
        return;
      })
    });
  });
};

DataLoader.prototype.getData = function (file, version, languages) {
  var log = this.log;
  var JSONClient = this.JSONClient;
  var self = this;
  return new Promise((res, rej) => {
    if(!JSONClient) {
      log.error(`Can't load data, no JSONClient loaded!`);
      return rej();
    }

    var allProms = [];
    var data = {};
    languages.forEach(l => {
      var fileObj = {
        cacheName: `${l}/${file}`,
        version: version,
        cdnLoc: `/cdn/${version}/data/${l}/${file}.json`
      }
      allProms.push(self.loadFile(fileObj, {lang: l}));
    });
    Promise.map(allProms, d => {
      data[d.custom.lang] = d.data;
    }, {concurrency: 10}).then(() => {
      res(data);
      return;
    });
  });
};

DataLoader.prototype.getFullChampionData = function (champions, version, languages) {
  var log = this.log;
  var JSONClient = this.JSONClient;
  var self = this;
  return new Promise((res, rej) => {
    if(!JSONClient) {
      log.error(`Can't load data, no JSONClient loaded!`);
      return rej();
    }

    var allProms = [];
    var data = {};
    languages.forEach(l => {
      champions.forEach(c => {
        var fileObj = {
          cacheName: `${l}/champion/${c}`,
          version: version,
          cdnLoc: `/cdn/${version}/data/${l}/champion/${c}.json`
        }
        allProms.push(self.loadFile(fileObj, {lang: l, champ: c}));
      });
    });
    Promise.map(allProms, d => {
      if(!data[d.custom.lang]) {data[d.custom.lang] = {};}
      data[d.custom.lang][d.custom.champ] = d.data[d.custom.champ];
    }, {concurrency: 1}).then(() => {
      res(data);
      return;
    });
  });
};

DataLoader.prototype.loadFile = function (fileObj, custom) {
  var log = this.log;
  var JSONClient = this.JSONClient;
  var self = this;
  log.debug(`Loading ${fileObj.cacheName}.`);
  return this.loadFromCache(fileObj.cacheName, fileObj.version).then(d => {
    log.debug(`${fileObj.cacheName} loaded.`);
    d.custom = custom;
    return d;
  }, e => {
    log.debug(`${fileObj.cacheName} not cached. Downloading from ${fileObj.cdnLoc}.`);
    return JSONClient.getAsync(fileObj.cdnLoc).spread((req, res, obj) => {
      log.debug(`${fileObj.cacheName} downloaded.`);
      self.saveToCache(fileObj.cacheName, fileObj.version, obj);
      obj.custom = custom;
      return obj;
    });
  });
};

module.exports = DataLoader;
