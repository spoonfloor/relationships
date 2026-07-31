#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

async function main() {
  const fromArg = process.argv[2];
  let password = fromArg;

  if (!password) {
    const rl = createInterface({ input, output });
    password = await rl.question("Editing password: ");
    rl.close();
  }

  if (!password) {
    console.error("No password provided.");
    process.exit(1);
  }

  console.log(hashPassword(password));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
