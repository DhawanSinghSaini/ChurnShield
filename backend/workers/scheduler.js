const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const { runInterventionEngine } = require('./interventionEngine');
const { runDailyPulse } = require('./dailyPulse');

function runMlPipeline() {
  console.log(`[${new Date().toISOString()}] [Scheduler] Triggering ML prediction and scoring pipeline...`);
  
  const scriptPath = path.join(__dirname, '..', 'ml', 'ml_pipeline.py');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  exec(`"${pythonCmd}" "${scriptPath}"`, async (error, stdout, stderr) => {
    if (error) {
      console.error(`[${new Date().toISOString()}] [Scheduler] ML pipeline failed:`, error);
      return;
    }
    if (stdout) {
      console.log(`[${new Date().toISOString()}] [Scheduler] Pipeline Output:\n${stdout}`);
    }
    if (stderr) {
      console.warn(`[${new Date().toISOString()}] [Scheduler] Pipeline Warnings/Errors:\n${stderr}`);
    }

    // Call the intervention alert engine
    try {
      await runInterventionEngine();
    } catch (intError) {
      console.error('[Scheduler] Failed running intervention checks:', intError);
    }
  });
}

// 1. Run ML Pipeline nightly at 2:00 AM
cron.schedule('0 2 * * *', () => {
  runMlPipeline();
});

// 2. Run Daily Pulse digest reports at 8:00 AM
cron.schedule('0 8 * * *', () => {
  runDailyPulse();
});

console.log('ChurnShield Nightly Scheduler successfully initialized.');

module.exports = { runMlPipeline, runDailyPulse };