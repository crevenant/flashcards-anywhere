const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

describe('Electron Integration', () => {
  let electronProcess;

  beforeAll((done) => {
    // Start Electron app
    electronProcess = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['electron', '.'],
      {
        cwd: path.join(__dirname, '..'),
        stdio: 'ignore',
        env: { ...process.env, NODE_ENV: 'test' },
        detached: true,
      }
    );
    // Wait for backend to be up (try connecting to port 8000)
    const tryConnect = () => {
      const client = net.createConnection({ port: 8000 }, () => {
        client.end();
        done();
      });
      client.on('error', () => setTimeout(tryConnect, 500));
    };
    tryConnect();
  }, 20000);

  afterAll(() => {
    if (electronProcess && !electronProcess.killed) {
      try {
        process.kill(-electronProcess.pid);
      } catch (e) {}
    }
  });

  test('Electron app starts and backend is available', (done) => {
    // Try connecting to backend
    const client = net.createConnection({ port: 8000 }, () => {
      client.end();
      done();
    });
    client.on('error', (err) => {
      done.fail('Backend server not available: ' + err.message);
    });
  });
});
