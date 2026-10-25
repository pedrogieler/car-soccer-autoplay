import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadSimulation } from './helpers.mjs';

const source = await readFile(new URL('../scripts/game.js', import.meta.url), 'utf8');
const baseline = JSON.parse(await readFile(new URL('./baseline.json', import.meta.url), 'utf8'));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

for (const recording of baseline.recordings) {
  test(`physics and bots preserve the original match, seed ${recording.seed}`, () => {
    const { api } = loadSimulation(source, recording.seed);
    let tick = 0;
    for (const checkpoint of recording.checkpoints) {
      while (tick < checkpoint.tick) { api.game.step(1 / 240); tick++; }
      assert.equal(digest(api.game.state), checkpoint.sha256, `State changed at tick ${tick}`);
    }
  });
}

test('renderer keeps ball, cars and scoreboard valid after play starts', () => {
  const { api, elements } = loadSimulation(source);
  for (let i = 0; i < 2400; i++) api.game.step(1 / 240);
  api.draw();
  const artwork = elements.get('aq-action').innerHTML;
  assert.ok(artwork.includes('aq-car-body'));
  assert.ok(artwork.includes('<circle r="25"'));
  assert.ok(!/NaN|Infinity|undefined/.test(artwork));
  assert.match(elements.get('aq-time').textContent, /^\d{2}:\d{2}$/);
});

test('page uses local external assets and preserves the arena drawing', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/<iframe\b|<script\b[^>]*>\s*\S/i.test(html.replace(/<script\b[^>]*src=[^>]*><\/script>/gi, '')));
  assert.match(html, /<script src="\.\/scripts\/game\.js" defer><\/script>/);
  const arena = html.match(/<svg\b[^>]*\bid="aq-arena"[\s\S]*?<\/svg>/i)?.[0];
  assert.ok(arena);
  assert.equal(createHash('sha256').update(arena).digest('hex'), baseline.arenaSha256);
  for (const asset of ['styles/base.css', 'styles/arena.css', 'scripts/game.js']) {
    assert.ok((await readFile(new URL('../' + asset, import.meta.url))).length > 0);
  }
});
