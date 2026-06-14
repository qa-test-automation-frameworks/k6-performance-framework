const required = '10.9.4';
const actual = process.env.npm_config_user_agent?.match(/\bnpm\/([^\s]+)/)?.[1];

if (actual !== required) {
  console.error(
    `This repository requires npm ${required}; detected ${actual ?? 'an unknown npm version'}. Run: npx --yes npm@${required} ci`,
  );
  process.exit(1);
}
