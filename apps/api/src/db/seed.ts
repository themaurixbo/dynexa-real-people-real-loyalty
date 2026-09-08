import { db } from "./client.js";
console.log("seed: nothing yet, use the API");
await (db as any).$client?.end?.();
