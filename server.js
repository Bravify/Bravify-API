// Required external packages
var restify = require('restify');
var bunyan = require('bunyan');
var chance = new (require('chance'))();
var restifyBunyanLogger = require('restify-bunyan-logger');
var semver = require('semver');
var DataLoader = require('./lib/DataLoader');
var SummonerSpells = require('./lib/SummonerSpells');

// our variables
var appName = require('./package.json').name;
var appVersion = require('./package.json').version;
var appAuthor = require('./package.json').author;
var adjectives = require('./data/Adjectives');
var UPDATE_LOOP_TIME = 60000; // ms, one minute.
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
  summoner: null,
  version: {},
  language: [],
  langData: {}
}

// Client used to gather data from Riot.
var dLoader = new DataLoader({
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
  res.send({app: appName, version: appVersion, message: "Welcome to the Bravify API! For more information, please visit https://github.com/Bravify/Bravify-API.",
    endpoints: {
      champion: {
        'Single-champion full': '/champion/:lang/:name/full',
        'Single-champion basic': '/champion/:lang/:name',
        'All-champion full': '/champion/:lang/full',
        'All-champion basic': '/champion/:lang',
        'Random champion full': '/champion/:lang/random/full',
        'Random champion basic': '/champion/:lang/random'
      },
      item: {
        'Single item': '/item/:lang/:id',
        'All items': '/item/:lang',
        'Random item': '/item/:lang/random'
      },
      summoner: {
        'Single summoner spell': '/summoner/:lang/:id',
        'All summoner spells': '/summoner/:lang',
        'Random summoner spell': '/summoner/:lang/random'
      },
      adjective: {
        'Random adjective': '/adjective/random',
        'Single adjective': '/adjective/:id',
        'All adjectives': '/adjective'
      },
      language: {
        'Client language data': '/language/:lang',
        'All supported languages': '/language'
      },
      version: {
        'Riot DDragon version': '/version/riot',
        'Bravify-API version': '/version/api'
      }
    }
  });
  return next();
});

server.get('/version/:tag', (req, res, next) => {
  switch(req.params.tag) {
    case 'riot':
      res.send(riotData.version.v || "");
      break;
    case 'api':
    default:
      res.send(appVersion || "");
      break;
  }
  return next();
});

server.get('/version/:tag/full', (req, res, next) => {
  switch(req.params.tag) {
    case 'riot':
      res.send(riotData.version || {});
      break;
    case 'api':
    default:
      res.send({name: appName, version: appVersion});
      break;
  }
  return next();
});

server.get('/champion/random/full', (req, res, next) => {
  var lang = 'en_US';
  if(riotData.champion[lang]) {
    res.send(riotData.fullChampion[lang][chance.pickone(Object.keys(riotData.fullChampion[lang]))]);
  } else {
    res.send({});
  }
  return next();
});

server.get('/champion/:lang/random/full', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  if(riotData.fullChampion[lang]) {
    res.send(riotData.fullChampion[lang][chance.pickone(Object.keys(riotData.fullChampion[lang]))]);
  } else {
    res.send({});
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

server.get('/champion/:lang/random', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  if(riotData.champion[lang]) {
    res.send(riotData.champion[lang][chance.pickone(Object.keys(riotData.champion[lang]))]);
  } else {
    res.send({});
  }
  return next();
});

server.get('/champion/:lang/:name', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  if(!req.params.name) {
    res.send(riotData.champion[lang] || {});
  } else {
    if(riotData.champion[lang][req.params.name]) {
      res.send(riotData.champion[lang][req.params.name]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/champion/random', (req, res, next) => {
  var lang = 'en_US';
  if(riotData.champion[lang]) {
    res.send(riotData.champion[lang][chance.pickone(Object.keys(riotData.champion[lang]))]);
  } else {
    res.send({});
  }
  return next();
});

server.get('/champion/:lang', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  res.send(riotData.champion[lang] || {});
  return next();
});

server.get('/champion', (req, res, next) => {
  res.send(riotData.champion['en_US'] || {});
  return next();
});

server.get('/item/:lang/random', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  if(riotData.item[lang]) {
    res.send(riotData.item[lang][chance.pickone(Object.keys(riotData.item[lang]))]);
  } else {
    res.send({});
  }
  return next();
});

server.get('/item/:lang/:id', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  if(!req.params.id) {
    res.send(riotData.item[lang] || {});
  } else {
    if(riotData.item[lang][req.params.id]) {
      res.send(riotData.item[lang][req.params.id]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/item/random', (req, res, next) => {
  var lang = 'en_US';
  if(riotData.item[lang]) {
    res.send(riotData.item[lang][chance.pickone(Object.keys(riotData.item[lang]))]);
  } else {
    res.send({});
  }
  return next();
});

server.get('/item/:lang', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  res.send(riotData.item[lang] || {});
  return next();
});

server.get('/item', (req, res, next) => {
  res.send(riotData.item['en_US'] || {});
  return next();
});

server.get('/summoner/:lang/:mode/random/:num', (req, res, next) => {
  if(!riotData.summoner) {
    res.send({}); // TODO: return error indicating to try again later.
  } else {
    res.send(riotData.summoner.getRandom({
      count: Math.min(req.params.num, 200),
      lang: req.params.lang,
      mode: req.params.mode
    }));
  }
  return next();
});

server.get('/summoner/:mode/random/:num', (req, res, next) => {
  if(!riotData.summoner) {
    res.send({}); // TODO: return error indicating to try again later.
  } else {
    res.send(riotData.summoner.getRandom({
      count: Math.min(req.params.num, 200),
      lang: 'en_US',
      mode: req.params.mode
    }));
  }
  return next();
});

server.get('/summoner/:lang/:mode/random', (req, res, next) => {
  if(!riotData.summoner) {
    res.send({}); // TODO: return error indicating to try again later.
  } else {
    res.send(riotData.summoner.getRandom({
      count: 1,
      lang: req.params.lang,
      mode: req.params.mode
    }));
  }
  return next();
});

server.get('/summoner/:lang/:id', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  if(!req.params.id) {
    res.send(riotData.summoner[lang] || {});
  } else {
    if(riotData.summoner[lang][req.params.id]) {
      res.send(riotData.summoner[lang][req.params.id]);
    } else {
      res.send({});
    }
  }
  return next();
});

server.get('/summoner/:mode/random', (req, res, next) => {
  if(!riotData.summoner) {
    res.send({}); // TODO: return error indicating to try again later.
  } else {
    res.send(riotData.summoner.getRandom({
      count: 1,
      lang: 'en_US',
      mode: req.params.mode
    }));
  }
  return next();
});

server.get('/summoner/:lang', (req, res, next) => {
  var lang = req.params.lang || 'en_US';
  res.send(riotData.summoner[lang] || {});
  return next();
});

server.get('/summoner', (req, res, next) => {
  res.send(riotData.summoner['en_US'] || {});
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
  dLoader.on('ready', () => {
    updateLoop(); // kick off the update loop.
  });
});

function updateLoop() {
  var arrEq = require('./lib/Helpers').arraysEqual;
  log.info('Starting update loop.');
  dLoader.getRealmAndLangListData('na').then(d => {
    riotData.version = d.version;
    if(!riotData.language.length || !arrEq(riotData.language, d.lang)) {
      riotData.language = d.lang;
      log.debug(`Loading language data.`);
      return dLoader.getData('language', d.version.v, d.lang).then(data => {
        log.debug(`Language data loaded.`);
        return {
          version: d.version.v,
          lang: d.lang,
          data: data
        };
      });
    } else {return false;}
  }).then(d => {
    if(d) {
      riotData.langData = d.data;
      log.debug(`Loading item data.`);
      return dLoader.getData('item', d.version, d.lang).then(data => {
        log.debug(`Item data loaded.`);
        return {
          version: d.version,
          lang: d.lang,
          data: data
        }
      });
    } else {return false;}
  }).then(d => {
    if(d) {
      riotData.item = d.data;
      log.debug(`Loading summoner spell data.`);
      return dLoader.getData('summoner', d.version, d.lang).then(data => {
        log.debug(`Summoner spell data loaded.`);
        return {
          version: d.version,
          lang: d.lang,
          data: data
        }
      });
    } else {return false;}
  }).then(d => {
    if(d) {
      riotData.summoner = new SummonerSpells(d.data);
      log.debug(`Loading champion data.`);
      return dLoader.getData('champion', d.version, d.lang).then(data => {
        log.debug(`Champion data loaded.`);
        return {
          version: d.version,
          lang: d.lang,
          data: data
        }
      });
    } else {return false;}
  }).then(d => {
    if(d) {
      riotData.champion = d.data;
      log.debug(`Loading full champion data.`);
      return dLoader.getFullChampionData(Object.keys(d.data.en_US), d.version, d.lang).then(data => {
        log.debug(`Full champion data loaded.`);
        return {
          version: d.version,
          lang: d.lang,
          data: data
        }
      });
    } else {return false;}
  }).then(d => {
    if(d) {
      riotData.fullChampion = d.data;
    } else {return false;}
  }).then(() => {
    log.info(`Update loop finished.`);
    setTimeout(updateLoop, UPDATE_LOOP_TIME);
  });
}

function isCacheValid(cVer, nVer) {
  return !semver.gt(nVer, cVer);
}
