import { readFile, writeFile } from "node:fs/promises";

const configPath = new URL("../dist/server/wrangler.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));

config.name = "finance";
config.topLevelName = "finance";
config.d1_databases = [
  {
    binding: "DB",
    database_name: "finance-db",
    database_id: "3b7e8ddb-3a36-4f79-9d52-6dfa6e1cc294",
  },
];

await writeFile(configPath, `${JSON.stringify(config)}\n`);
