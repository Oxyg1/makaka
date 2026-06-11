module.exports = {
  apps: [{
    name: 'backend',
    cwd: './backend',
    script: 'npx',
    args: 'tsx src/index.ts',
    interpreter: 'none',
    env: { NODE_ENV: 'production' },
    restart_delay: 3000,
    max_restarts: 10,
    watch: false,
  }],
};
