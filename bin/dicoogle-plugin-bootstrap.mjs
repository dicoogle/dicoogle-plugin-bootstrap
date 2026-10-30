#!/usr/bin/env node
import { installSigintHandler, main } from "../src/cli.mjs";

installSigintHandler();
process.exitCode = await main(process.argv.slice(2));
