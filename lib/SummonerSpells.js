const c = new(require('chance'))();

function SummonerSpells(spellData) {
  this.spells = spellData;
}

/**
 * Get a number of random summoner spells.
 * @param  {Object} options
 * @param  {Number} options.count   The number of spells to retrieve. Forced to a positive value. Default: 1.
 * @param  {String} options.mode    The valid mode to retrieve spells for. Default: 'CLASSIC'.
 * @param  {String} options.lang    The language to retrieve spells in. Default: 'en_US'.
 * @return {Array}                  An array of randomized summoner spells.
 */
//TODO: Promisify?
SummonerSpells.prototype.getRandom = function (options) {
  if(!options) {
    options = {
      count: 1,
      lang: 'en_US',
      mode: 'CLASSIC'
    };
  }

  if(!options.mode || !options.mode.length) { options.mode = 'CLASSIC'; }
  if(!options.lang) { options.lang = 'en_US'; }
  if(!options.count || options.count < 1) { options.count = 1; }

  var summs = [];

  while (summs.length !== options.count) {
    // get item from spells object by picking a random key from the object.
    let s = this.spells[options.lang][c.pickone(Object.keys(this.spells[options.lang]))];

    if(s.modes.includes(options.mode) && !summs.includes(s)) {
      summs.push(s); // push our spell to the array to be returned if it matches all requrements.
    }
  }

  return summs;
};

module.exports = SummonerSpells;
