$ErrorActionPreference = 'Stop'
node -e @'
const fs = require("fs");
const files = fs.readdirSync("reports").filter((name) => name.endsWith("-results.json"));
const summary = files.map((name) => ({ file: name, bytes: fs.statSync(`reports/${name}`).size }));
fs.writeFileSync("reports/index.json", JSON.stringify({ generatedAt: new Date().toISOString(), results: summary }, null, 2));
console.log(`Indexed ${files.length} result files`);
'@
