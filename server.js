// Required external packages
var restify = require('restify');
var Promise = require('bluebird');
var bunyan = require('bunyan');
var chance = new (require('chance'))();
var fs = Promise.promisifyAll(require("graceful-fs"));
var rimraf = require("rimraf");
var path = require('path');
var restifyBunyanLogger = require('restify-bunyan-logger');
var mkdir = require('mkdirp');
var semver = require('semver');
Promise.promisifyAll(restify.JsonClient.prototype, {multiArgs: true});

// our variables
var appName = require('./package.json').name;
var appVersion = require('./package.json').version;
var appAuthor = require('./package.json').author;
var adjectives = require('./data/Adjectives');
var UPDATE_LOOP_TIME = 10000; // ms
var log = bunyan.createLogger({
  name: appName,
  level: 'debug',
  serializers: {
    req: bunyan.stdSerializers.req
  }
});

// To be filled by update loop once server starts.
var riotData = {
  champion: {},
  fullChampion: {},
  item: {},
  summoner: {},
  version: {},
  language: [],
  langData: {}
}

// Client used to gather data from Riot.
var DDragonClient = restify.createJsonClient({
  url: 'https://ddragon.leagueoflegends.com',
  version: '*',
  log: log,
  userAgent: `${appName} v${appVersion} - ${appAuthor}`
});

var server = restify.createServer({
  name: appName,
  version: appVersion,
  log: log
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());
server.on('after', restifyBunyanLogger());

server.get('/', (req, res, next) => {
  res.send({app: appName, version: appVersion, message: "Welcome to the Bravify API! For more information, please visit https://github.com/Bravify/Bravify-API."});
  return next();
});

server.get('/version/:tag', (req, res, next) => {
  switch(req.params.tag) {
    case 'riot':
      res.send(riotData.version.v || "");
      break;
    case 'champion':
      res.send(riotData.champion.version || "");
      break;
    case 'api':
    default:
      res.send({name: appName, version: appVersion, author: appAuthor});
      break;
  }
  return next();
});

server.get('/champion/:lang/:name/full', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  if(!req.params.name) {
    res.send(riotData.fullChampion[lang] || {});
  } else {
    if(riotData.fullChampion[lang][req.params.name]) {
      res.send(riotData.fullChampion[lang][req.params.name]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/champion/:lang/full', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  res.send(riotData.fullChampion[lang] || {});
  return next();
});

server.get('/champion/:lang/:name', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  if(!req.params.name) {
    res.send(riotData.champion[lang] || {});
  } else {
    if(riotData.champion[lang].data[req.params.name]) {
      res.send(riotData.champion[lang].data[req.params.name]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/champion/:lang', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  res.send(riotData.champion[lang] || {});
  return next();
});

server.get('/champion', (req, res, next) => {
  res.send(riotData.champion['en_US'].data || {});
  return next();
});

server.get('/item/:lang/:id', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  if(!req.params.id) {
    res.send(riotData.item[lang].data || {});
  } else {
    if(riotData.item[lang].data[req.params.id]) {
      res.send(riotData.item[lang].data[req.params.id]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/item/:lang', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  res.send(riotData.item[lang].data || {});
  return next();
});

server.get('/item', (req, res, next) => {
  res.send(riotData.item['en_US'].data || {});
  return next();
});

server.get('/summoner/:lang/:id', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  if(!req.params.id) {
    res.send(riotData.summoner[lang].data || {});
  } else {
    if(riotData.summoner[lang].data[req.params.id]) {
      res.send(riotData.summoner[lang].data[req.params.id]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/summoner/:lang', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  res.send(riotData.summoner[lang].data || {});
  return next();
});

server.get('/summoner', (req, res, next) => {
  res.send(riotData.summoner['en_US'].data || {});
  return next();
});

server.get('/adjective/random', (req, res, next) => {
  res.send({adjective: chance.pickone(adjectives) || {}});
  return next();
});

server.get('/adjective/:id', (req, res, next) => {
  var id = (req.params.id || 0);
  if(!adjectives[id]) { id = 0; }
  res.send({adjective: adjectives[req.params.id] || null});
  return next();
});

server.get('/adjective', (req, res, next) => {
  res.send(adjectives || {});
  return next();
});

server.get('/language/:lang', (req, res, next) => {
  res.send(riotData.langData[req.params.lang] || {});
  return next();
});

server.get('/language', (req, res, next) => {
  res.send(riotData.language || ['en_US']); // language data can have a safe default.
  return next();
});

server.listen(8080, function () {
  log.info('%s listening at %s', server.name, server.url);
  updateLoop(); // kick off the update loop.
});

function saveToCache(data, name, version) {
  //mkdirp first, just in case.
  var filePath = path.resolve('cache', version, `${name}`);
  mkdir(path.dirname(filePath), e => {
    if(e) { log.error(e, `couldn't create folder ${path.dirname(filePath)}. expect terrible things ahead!`); }
    fs.writeFileAsync(filePath + '.json', JSON.stringify(data, null, 2)).then(() => {
      log.debug(`saved cache data to ${version}/${name}.json.`);
    }).catch(e => {
      log.error(e, `error saving data to cache/${version}/${name}.json`);
    });
  });
}

function loadFromCache(name, version) {
  return fs.readFileAsync(path.resolve('cache', version, `${name}.json`), 'utf8').then(d => {
    return JSON.parse(d);
  });
}

function clearCache() {
 rimraf.sync(path.resolve('cache'));
 mkdir.sync(path.resolve('cache'));
}

function updateLoop() {
  log.debug('Starting update loop.');
  getDataFromRiotDDragon();
  setTimeout(updateLoop, UPDATE_LOOP_TIME);
}

function getDataFromRiotDDragon() {
  // download the realms JSON for version data.
  log.debug('Downloading realms/na.json');
  DDragonClient.getAsync('/realms/na.json').spread((req, res, obj) => {
    log.debug('Successfully downloaded realms/na.json.');
    var cacheValid = true; // assume we have a good cache and aren't on our initial load.
    var initialLoad = false; // variables will be set if needed next.

    if(riotData.version.v) {
      if(semver.gt(obj.v, riotData.version.v)) {
        log.info(`Newer version found! Invalidating caches.`);
        cacheValid = false;
        clearCache();
      }
    } else {
      log.info(`Beginning initial data load!`);
      initialLoad = true;
    }

    riotData.version = obj;
    riotData.version.downloadTime = new Date().getTime();

    return {v: obj.v, load: (!cacheValid || initialLoad)};
  }).then(o => {
    if(!o.load) {return o;}
    // download the languages.json for up-to-date language data.
    return DDragonClient.getAsync('/cdn/languages.json').spread((req, res, obj) => {
      log.debug('Successfully downloaded languages.json.');
      riotData.language = obj;
      return {l: obj, v: o.v, load: o.load};
    });
  }).then(o => {
    // each section below follows the same general structure, attempting to load
    // from the cache before downloading from DDragon.
    // o is an Object containing l, an array of language codes, and v, a version number.

    if(!o.load) {return o;}

    //load basic champion data.
    o.l.forEach(l => {
      //make sure we have the proper object structure already.
      if(!riotData.champion[l]) {riotData.champion[l] = {}}
      if(!riotData.fullChampion[l]) {riotData.fullChampion[l] = {}}

      loadFromCache(`${l}/champion`, o.v).then(d => {
        log.debug(`Loaded ${l}/champion.json from cache.`);
        riotData.champion[l] = d;
        return d.data;
      }, e => {
        log.debug({code: e.code}, `Unable to load ${l}/champion.json from cache. Downloading from DDragon.`);
        return DDragonClient.getAsync(`/cdn/${o.v}/data/${l}/champion.json`).spread((req, res, obj) => {
          log.debug(`Successfully downloaded cdn/${o.v}/data/${l}/champion.json.`);
          riotData.champion = obj;
          saveToCache(obj, `${l}/champion`, o.v);
          return obj.data;
        });
      }).then(d => {
        //populate full champion data. lots of data here :D
        Object.keys(d).forEach(k => {
          loadFromCache(`${l}/champion/${k}`, o.v).then(d => {
            log.debug(`Loaded ${l}/champion/${k}.json from cache.`);
            riotData.fullChampion[l][k] = d;
            return d;
          }).catch(e => {
            log.debug({code: e.code}, `Unable to load ${l}/champion/${k}.json from cache. Downloading from DDragon.`);
            DDragonClient.getAsync(`/cdn/${o.v}/data/${l}/champion/${k}.json`).spread((req, res, obj) => {
              log.debug(`Successfully downloaded cdn/${o.v}/data/${l}/champion/${k}.json.`);
              saveToCache(obj, `${l}/champion/${k}`, o.v);
              riotData.fullChampion[l][k] = obj;
            });
          });
        });
      });
    });
    return o;
  }).then(o => {
    if(!o.load) {return o;}
    //load summoner spell data.
    o.l.forEach(l => {
      //make sure we have the proper object structure.
      if(!riotData.summoner[l]) {riotData.summoner[l] = {}}

      loadFromCache(`${l}/summoner`, o.v).then(d => {
        log.debug(`Loaded ${l}/summoner.json from cache.`);
        riotData.summoner[l] = d;
        return d.data;
      }, e => {
        log.debug({code: e.code}, `Unable to load ${l}/summoner.json from cache. Downloading from DDragon.`);
        return DDragonClient.getAsync(`/cdn/${o.v}/data/${l}/summoner.json`).spread((req, res, obj) => {
          log.debug(`Successfully downloaded cdn/${o.v}/data/${l}/summoner.json.`);
          riotData.summoner[l] = obj;
          saveToCache(obj, `${l}/summoner`, o.v);
          return obj.data;
        });
      });
    });
    return o;
  }).then(o => {
    if(!o.load) {return o;}
    //load item data.
    o.l.forEach(l => {
      //make sure we have the proper object structure.
      if(!riotData.item[l]) {riotData.item[l] = {}}

      loadFromCache(`${l}/item`, o.v).then(d => {
        log.debug(`Loaded ${l}/item.json from cache.`);
        riotData.item[l] = d;
        return d.data;
      }, e => {
        log.debug({code: e.code}, `Unable to load ${l}/item.json from cache. Downloading from DDragon.`);
        return DDragonClient.getAsync(`/cdn/${o.v}/data/${l}/item.json`).spread((req, res, obj) => {
          log.debug(`Successfully downloaded cdn/${o.v}/data/${l}/item.json.`);
          riotData.item[l] = obj;
          saveToCache(obj, `${l}/item`, o.v);
          return obj.data;
        });
      });
    });
    return o;
  }).then(o => {
    if(!o.load) {return o;}
    //load language data.
    o.l.forEach(l => {
      //make sure we have the proper object structure.
      if(!riotData.langData[l]) {riotData.langData[l] = {}}

      loadFromCache(`${l}/language`, o.v).then(d => {
        log.debug(`Loaded ${l}/language.json from cache.`);
        riotData.langData[l] = d;
        return d.data;
      }, e => {
        log.debug({code: e.code}, `Unable to load ${l}/language.json from cache. Downloading from DDragon.`);
        return DDragonClient.getAsync(`/cdn/${o.v}/data/${l}/language.json`).spread((req, res, obj) => {
          log.debug(`Successfully downloaded cdn/${o.v}/data/${l}/language.json.`);
          riotData.langData[l] = obj;
          saveToCache(obj, `${l}/language`, o.v);
          return obj.data;
        });
      });
    });
    return o;
  }).catch(e => {
    log.error(e, 'Error when downloading data from DDragon!');
  });
}
