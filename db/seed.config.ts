import { SeedPg } from "@snaplet/seed/adapter-pg";
import { defineConfig } from "@snaplet/seed/config";
import { Client } from "pg";

export default defineConfig({
  adapter: async () => {
    const client = new Client({
      connectionString:
        "postgresql://postgres:postgres@127.0.0.1:54332/postgres",
    });
    await client.connect();
    return new SeedPg(client);
  },
  // use all schemas (including auth)
  // select: ["!*", "public.*"],
});
