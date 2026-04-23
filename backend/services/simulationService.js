const { runBinFillSimulationTick } = require('./binService');

const TICK_MS = 30 * 1000;

function startBinFillSimulation({ broadcast }) {
  async function tick() {
    try {
      const changedBins = await runBinFillSimulationTick();
      for (const bin of changedBins) {
        broadcast({ type: 'BIN_UPDATED', bin });
      }
    } catch (error) {
      console.error('[Simulation] Tick failed:', error.message);
    }
  }

  const intervalId = setInterval(tick, TICK_MS);
  return {
    stop: () => clearInterval(intervalId),
  };
}

module.exports = { startBinFillSimulation };
