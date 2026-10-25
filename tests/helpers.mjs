import vm from 'node:vm';

export function loadSimulation(source, seed = 20261022) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', hidden: false });
    return elements.get(id);
  };
  const root = { querySelector: selector => element(selector.slice(1)) };
  const seededMath = Object.create(Math);
  seededMath.random = () => seed / 4294967296;
  const context = {
    document: { getElementById: id => id === 'aquadome-futebol-preview' ? root : null },
    window: {}, Math: seededMath, matchMedia: () => ({ matches: false }),
    requestAnimationFrame: () => {},
  };
  vm.runInNewContext(source, context, { timeout: 5000, filename: 'game.js' });
  if (!context.window.__aquadomeSoccerPreview) throw new Error('Simulation did not initialize.');
  return { api: context.window.__aquadomeSoccerPreview, elements };
}
