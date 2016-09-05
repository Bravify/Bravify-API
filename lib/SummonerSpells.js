const c = new(require('chance'))();

function SummonerSpells(spellData) {
  this.spells = spellData;
}

/**
 * Get a number of random summoner spells.
 * @param  {Object} options
 * @param  {Number} options.count   The number of spells to retrieve. Forced to a positive value. Default: 1.
 * @param  {Array}  options.modes   The valid modes to retrieve spells for. Default: ['CLASSIC'].
 * @param  {String} options.lang    The language to retrieve spells in. Default: 'en_US'.
 * @return {Array}                  An array of randomized summoner spells.
 */
//TODO: Promisify?
SummonerSpells.prototype.getRandom = function (options) {
  if(!options) {
    options = {
      count: 1,
      lang: 'en_US',
      modes: ['CLASSIC']
    };
  }

  if(!options.modes || !options.modes.length) { options.modes = ['CLASSIC']; }
  if(!options.lang) { options.lang = 'en_US'; }
  if(!options.count || options.count < 1) { options.count = 1; }

  var summs = [];

  for (let i = 0; i < options.count; i++) {
    // get item from spells object by picking a random key from the object.
    let s = this.spells[options.lang][c.pickone(Object.keys(this.spells[options.lang]))];

    // whether or not we've got a required mode.
    let m = false;

    for (let j = 0; j < options.modes.length; j++) {
      if(s.modes.includes(options.modes[j])) { m = true; break; }
    }

    if(!m) {
      i--; // reset back one iteration, so we don't skip spells.
    } else {
      summs.push(s); // push our spell to the array to be returned if it matches all requrements.
    }
  }

  return summs;
};

module.exports = SummonerSpells;
