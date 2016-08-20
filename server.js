// Required external packages
var restify = require('restify');
var Promise = require('bluebird');
var bunyan = require('bunyan');
var restifyBunyanLogger = require('restify-bunyan-logger');
Promise.promisifyAll(restify.JsonClient.prototype, {multiArgs: true});

// our variables
var appName = require('./package.json').name;
var appVersion = require('./package.json').version;
var appAuthor = require('./package.json').author;
var UPDATE_LOOP_TIME = 600000; // ms
var log = bunyan.createLogger({
  name: appName,
  version: appVersion,
  level: 'debug',
  serializers: {
    req: bunyan.stdSerializers.req
    //res: restify.bunyan.serializers.response,
  }
});

// To be filled by update loop once server starts.
var riotData = {
  champion: {},
  fullChampion: {},
  item: {},
  spell: {},
  version: {}
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

server.get('/version/:tag', (req, res, next) => {
  switch(req.params.tag) {
    case 'riot':
      res.send(riotData.version.v || null);
      break;
    case 'champion':
      res.send(riotData.champion.version || null);
      break;
    case 'api':
    default:
      res.send({name: appName, version: appVersion, author: appAuthor});
      break;
  }
  return next();
});

server.get('/champion/:name', (req, res, next) => {
  if(!req.params.name) {
    res.send(riotData.champion.data || {});
  } else {
    if(riotData.champion.data[req.params.name]) {
      res.send(riotData.champion.data[req.params.name]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/champion', (req, res, next) => {
  res.send(riotData.champion.data || {});
  return next();
});

server.get('/fullchampion/:name', (req, res, next) => {
  if(!req.params.name) {
    res.send(riotData.fullChampion || {});
  } else {
    if(riotData.fullChampion[req.params.name]) {
      res.send(riotData.fullChampion[req.params.name]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/fullchampion', (req, res, next) => {
  res.send(riotData.fullChampion || {});
  return next();
});

server.get('/item/:id', (req, res, next) => {
  if(!req.params.id) {
    res.send(riotData.item.data || {});
  } else {
    if(riotData.item.data[req.params.id]) {
      res.send(riotData.item.data[req.params.id]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/item', (req, res, next) => {
  res.send(riotData.item.data || {});
  return next();
});

server.get('/spell/:name', (req, res, next) => {
  if(!req.params.name) {
    res.send(riotData.spell.data || {});
  } else {
    if(riotData.spell.data[req.params.name]) {
      res.send(riotData.spell.data[req.params.name]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/spell', (req, res, next) => {
  res.send(riotData.spell.data || {});
  return next();
});

server.listen(8080, function () {
  log.info('%s listening at %s', server.name, server.url);
  updateLoop(); // kick off the update loop.
});

function updateLoop() {
  log.debug('Starting update loop.');
  getDataFromRiotDDragon();
  setTimeout(updateLoop, UPDATE_LOOP_TIME);
}


function getDataFromRiotDDragon() {
  log.debug('Downloading realms/na.json');
  DDragonClient.getAsync('/realms/na.json').spread((req, res, obj) => {
    log.debug('Successfully downloaded realms/na.json.');
    riotData.version = obj;
    riotData.version.downloadTime = new Date().getTime();
    return {l: obj.l, v: obj.v};
  }).then(o => {
    log.debug(`Downloading cdn/${o.v}/data/${o.l}/champion.json`);
    DDragonClient.getAsync(`/cdn/${o.v}/data/${o.l}/champion.json`).spread((req, res, obj) => {
      log.debug(`Successfully downloaded cdn/${o.v}/data/${o.l}/champion.json.`);
      riotData.champion = obj;
      return obj.data;
    }).then(d => {
      //populate full champion data. lots of data here :D
      Object.keys(d).forEach(k => {
        log.debug(`Downloading cdn/${o.v}/data/${o.l}/champion/${k}.json`);
        DDragonClient.getAsync(`/cdn/${o.v}/data/${o.l}/champion/${k}.json`).spread((req, res, obj) => {
          log.debug(`Successfully downloaded cdn/${o.v}/data/${o.l}/champion/${k}.json.`);
          riotData.fullChampion[k] = obj;
        });
      });
    });
    return o;
  }).then(o => {
    log.debug(`Downloading cdn/${o.v}/data/${o.l}/summoner.json`);
    DDragonClient.getAsync(`/cdn/${o.v}/data/${o.l}/summoner.json`).spread((req, res, obj) => {
      log.debug(`Successfully downloaded cdn/${o.v}/data/${o.l}/summoner.json.`);
      riotData.spell = obj;
    });
    return o;
  }).then(o => {
    log.debug(`Downloading cdn/${o.v}/data/${o.l}/item.json`);
    DDragonClient.getAsync(`/cdn/${o.v}/data/${o.l}/item.json`).spread((req, res, obj) => {
      log.debug(`Successfully downloaded cdn/${o.v}/data/${o.l}/item.json.`);
      riotData.item = obj;
    });
    return o;
  }).catch(e => {
    log.error(e, 'Error when downloading data from DDragon!');
  });
}
