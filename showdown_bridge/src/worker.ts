/* Persistent multi-battle JSONL bridge. It intentionally never exports Battle internals. */
import * as readline from 'node:readline';
import * as path from 'node:path';
import {resolveMoveSemantics} from './move-semantics';

const showdownRoot = process.env.POKEMON_SHOWDOWN_ROOT || path.resolve(__dirname, '../../third_party/pokemon-showdown');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {BattleStream, getPlayerStreams} = require(path.join(showdownRoot, 'dist/sim/battle-stream'));
const {Dex} = require(path.join(showdownRoot, 'dist/sim/dex'));
const Gen3Dex = Dex.mod('gen3');

type Player = 'p1' | 'p2';
type PublicState = {target: null | {species: string, hpBucket: number, status: string, types: string[], estimatedSpeed: number}, weather: string, turn: number};
type Entry = {stream: any, requests: Partial<Record<Player, any>>, terminal: boolean,
  public: Record<Player, PublicState>, playerStreams: any};
const battles = new Map<string, Entry>();

function send(value: unknown) { process.stdout.write(JSON.stringify(value) + '\n'); }

function safeRequest(req: any, visible: PublicState) {
  if (!req || typeof req !== 'object') return {};
  // These are all player-specific fields emitted by Showdown. No battle object is consulted.
  return {
    rqid: req.rqid,
    wait: !!req.wait,
    forceSwitch: req.forceSwitch || null,
    teamPreview: !!req.teamPreview,
    active: req.active ? req.active.map((active: any) => ({...active,
      moves: (active.moves || []).map((m: any) => {
        const hiddenPower = /^Hidden Power ([A-Za-z]+)(?: (\d+))?$/.exec(m.move || '');
        const data = Gen3Dex.moves.get(hiddenPower ? m.move : m.id || m.move);
        const moveType = hiddenPower?.[1] || data.type;
        const basePower = hiddenPower?.[2] ? Number(hiddenPower[2]) : data.basePower;
        const semantics = resolveMoveSemantics(Gen3Dex, data, moveType, basePower, visible.target?.types || [], visible.target?.status || '');
        const legacyData = Dex.moves.get(m.id || m.move);
        let legacyEffectivenessBucket = 3;
        if (visible.target?.types?.length) {
          const immune = visible.target.types.every(type => !Dex.getImmunity(legacyData.type, type));
          if (immune) legacyEffectivenessBucket = 0;
          else {
            const exponent = visible.target.types.reduce((sum, type) => sum + Dex.getEffectiveness(legacyData.type, type), 0);
            legacyEffectivenessBucket = exponent <= -2 ? 1 : exponent === -1 ? 2 : exponent === 0 ? 3 : exponent === 1 ? 4 : 5;
          }
        }
        return {...m, id: data.id, type: moveType, basePower,
          accuracy: data.accuracy, priority: data.priority, status: data.status, target: data.target,
          boosts: data.boosts, self: data.self, secondary: data.secondary,
          fixedDamage: data.damage ?? (data.damageCallback ? 'callback' : undefined),
          isDamageMove: semantics.moveClass !== 'status', legacyType: legacyData.type,
          legacyBasePower: legacyData.basePower, legacyEffectivenessBucket, ...semantics};
      }),
    })) : null,
    side: req.side ? {
      id: req.side.id,
      name: req.side.name,
      pokemon: (req.side.pokemon || []).map((p: any) => ({
        ident: p.ident, details: p.details, condition: p.condition,
        active: !!p.active, stats: p.stats || null, moves: p.moves || [],
        types: Gen3Dex.species.get(String(p.details || '').split(',')[0]).types,
        baseAbility: p.baseAbility || '', item: p.item || '', pokeball: p.pokeball || '',
      })),
    } : null,
    public: visible,
  };
}

function legalActions(req: any) {
  const result: {index: number, choice: string}[] = [];
  if (!req || req.wait) return result;
  const mons = req.side?.pokemon || [];
  const switches = mons.map((p: any, i: number) => ({p, slot: i + 1}))
    .filter(({p}: any) => !p.active && !String(p.condition || '').startsWith('0 fnt'));
  if (req.forceSwitch?.[0]) {
    switches.slice(0, 5).forEach(({slot}: any, i: number) => result.push({index: 4 + i, choice: `switch ${slot}`}));
    return result;
  }
  const active = req.active?.[0];
  (active?.moves || []).forEach((m: any, i: number) => {
    if (!m.disabled && (m.pp == null || m.pp > 0)) result.push({index: i, choice: `move ${i + 1}`});
  });
  if (!active?.trapped && !active?.maybeTrapped) {
    switches.slice(0, 5).forEach(({slot}: any, i: number) => result.push({index: 4 + i, choice: `switch ${slot}`}));
  }
  return result;
}

function updatePublic(player: Player, state: PublicState, line: string) {
  const fields = line.split('|'); const cmd = fields[1] || '';
  const opponent = player === 'p1' ? 'p2' : 'p1';
  const hpBucket = (condition: string) => {
    if (condition.includes('fnt')) return 0;
    const match = condition.match(/(\d+)\/(\d+)/); if (!match) return 4;
    const hp = Number(match[1]), max = Number(match[2]);
    return hp <= 0 ? 0 : hp * 4 <= max ? 1 : hp * 2 <= max ? 2 : hp * 4 <= max * 3 ? 3 : 4;
  };
  if ((cmd === 'switch' || cmd === 'drag' || cmd === 'replace') && fields[2]?.startsWith(opponent)) {
    const species = (fields[3] || '').split(',')[0]; const dexSpecies = Gen3Dex.species.get(species);
    const levelMatch=(fields[3] || '').match(/L(\d+)/); const level=levelMatch ? Number(levelMatch[1]) : 100;
    const estimatedSpeed=Math.floor((2*dexSpecies.baseStats.spe+31)*level/100)+5;
    state.target = {species, hpBucket: hpBucket(fields[4] || '100/100'), status: (fields[4] || '').split(' ')[1] || '', types: dexSpecies.types || [], estimatedSpeed};
  } else if ((cmd === '-damage' || cmd === '-heal') && fields[2]?.startsWith(opponent) && state.target) {
    state.target.hpBucket = hpBucket(fields[3] || '');
    const status = (fields[3] || '').split(' ')[1]; if (status) state.target.status = status;
  } else if (cmd === '-status' && fields[2]?.startsWith(opponent) && state.target) state.target.status = fields[3] || '';
  else if (cmd === '-curestatus' && fields[2]?.startsWith(opponent) && state.target) state.target.status = '';
  else if (cmd === 'faint' && fields[2]?.startsWith(opponent) && state.target) state.target.hpBucket = 0;
  else if (cmd === '-weather') state.weather = fields[2] || '';
  else if (cmd === 'turn') state.turn = Number(fields[2]) || state.turn;
}

function processPlayerChunk(id: string, entry: Entry, player: Player, chunk: string) {
  for (const line of chunk.split('\n')) {
    updatePublic(player, entry.public[player], line);
    if (line.startsWith('|request|')) {
      const req = JSON.parse(line.slice('|request|'.length));
      entry.requests[player] = safeRequest(req, entry.public[player]);
      send({type: 'request', battle_id: id, player, request: entry.requests[player],
        legal_actions: legalActions(req), terminal: false});
    } else if ((line.startsWith('|win|') || line === '|tie') && !entry.terminal) {
      entry.terminal = true;
      send({type: 'end', battle_id: id, terminal: true, winner: line === '|tie' ? null : line.slice(5)});
    }
  }
}

async function reset(msg: any) {
  const started = performance.now();
  if (battles.has(msg.battle_id)) throw new Error('battle id already exists');
  const stream = new BattleStream({keepAlive: true});
  const playerStreams = getPlayerStreams(stream);
  const initial = () => ({target: null, weather: '', turn: 0});
  const entry: Entry = {stream, requests: {}, terminal: false, playerStreams,
    public: {p1: initial(), p2: initial()}};
  battles.set(msg.battle_id, entry);
  for (const player of ['p1', 'p2'] as Player[]) void (async () => {
    try { for await (const chunk of playerStreams[player]) processPlayerChunk(msg.battle_id, entry, player, chunk); }
    catch (error: any) { send({type: 'error', battle_id: msg.battle_id, error: error.message}); }
  })();
  const options = {formatid: msg.format || 'gen3customgame', seed: msg.seed};
  stream.write(`>start ${JSON.stringify(options)}\n>player p1 ${JSON.stringify({name: 'p1', team: msg.p1_team})}\n>player p2 ${JSON.stringify({name: 'p2', team: msg.p2_team})}`);
  send({type: 'reset_ack', battle_id: msg.battle_id, seed: msg.seed, worker_ms: performance.now() - started});
}

const rl = readline.createInterface({input: process.stdin, crlfDelay: Infinity});
rl.on('line', async (line: string) => {
  try {
    const msg = JSON.parse(line);
    if (msg.cmd === 'ping') return send({type: 'pong', active_battles: battles.size});
    if (msg.cmd === 'reset') return await reset(msg);
    const entry = battles.get(msg.battle_id);
    if (!entry) throw new Error(`unknown battle ${msg.battle_id}`);
    if (msg.cmd === 'act') {
      if (msg.player !== 'p1' && msg.player !== 'p2') throw new Error('invalid player');
      const started = performance.now(); entry.stream.write(`>${msg.player} ${msg.choice}`);
      return send({type: 'act_ack', battle_id: msg.battle_id, player: msg.player, worker_ms: performance.now() - started});
    }
    if (msg.cmd === 'close') {
      entry.stream.destroy(); battles.delete(msg.battle_id);
      return send({type: 'close_ack', battle_id: msg.battle_id});
    }
    throw new Error(`unknown command ${msg.cmd}`);
  } catch (error: any) { send({type: 'error', error: error.message}); }
});
