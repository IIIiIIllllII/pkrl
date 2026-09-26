// Public, static Gen 3 data only; never reads a running Battle.
const {Dex} = require('../third_party/pokemon-showdown/dist/sim/dex');
const dex = Dex.mod('gen3');
const moves = dex.moves.all().filter(m => m.num > 0 && m.num <= 354 && m.gen <= 3 && !m.isNonstandard).map(m => ({
  num: m.num, id: m.id, move: m.name, type: m.type, basePower: m.basePower,
  accuracy: m.accuracy, priority: m.priority, status: m.status,
  boosts: m.boosts, self: m.self, target: m.target,
  fixedDamage: m.damage ?? (m.damageCallback ? 'callback' : undefined),
  isDamageMove: m.category !== 'Status', pp: m.pp,
}));
module.exports = moves;
if (require.main === module) process.stdout.write(JSON.stringify(moves));
