module.exports = {
  apps: [
    {
      name: "poultry-manager",
      script: "./telegram_bot.mjs",
      watch: true,
      env: {
        NODE_ENV: "production"
      },
      exp_backoff_restart_delay: 100,
      max_memory_restart: "200M"
    }
  ]
};
