'use strict';

const { readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');

function serializeError(error) {
  return {
    name: error instanceof Error ? error.name : undefined,
    message: error instanceof Error ? error.message : String(error),
    code: error && typeof error === 'object' ? error.code : undefined,
    isError: error instanceof Error,
  };
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

async function main() {
  const [command, jsonFile, output] = process.argv.slice(2);

  if (command === 'root') {
    try {
      const root = require('tolkira');
      emit({ loaded: true, defaultType: typeof root.default });
    } catch (error) {
      emit({ loaded: false, error: serializeError(error) });
    }
    return;
  }

  const compat = require('tolkira/compat/cucumber-html-reporter');

  if (command === 'shape') {
    emit({
      generate: typeof compat.generate,
      default: compat.default,
      hasDefault: 'default' in compat,
    });
    return;
  }

  if (command === 'success') {
    const result = await compat.generate({ jsonFile, output });
    emit({ result, html: readFileSync(output, 'utf8') });
    return;
  }

  if (command === 'callback') {
    let callbacks = 0;
    let callbackError = null;
    const result = await compat.generate(
      { jsonFile, output },
      (error) => {
        callbacks += 1;
        callbackError = error ? serializeError(error) : null;
      },
    );
    await Promise.resolve();
    emit({
      callbacks,
      callbackError,
      result,
      html: readFileSync(output, 'utf8'),
    });
    return;
  }

  if (command === 'callback-error') {
    let callbackError = null;
    const promise = compat.generate({ output }, (error) => {
      callbackError = serializeError(error);
    });
    try {
      await promise;
      emit({ resolved: true, callbackError });
    } catch (error) {
      emit({
        resolved: false,
        callbackError,
        error: serializeError(error),
      });
    }
    return;
  }

  if (command === 'reject') {
    try {
      await compat.generate({ output });
      emit({ resolved: true });
    } catch (error) {
      emit({ resolved: false, error: serializeError(error) });
    }
    return;
  }

  if (command === 'write-error') {
    try {
      await compat.generate({ jsonFile, output });
      emit({ resolved: true });
    } catch (error) {
      const directory = path.dirname(output);
      emit({
        resolved: false,
        error: serializeError(error),
        outputIsDirectory: statSync(output).isDirectory(),
        entries: readdirSync(directory).sort(),
      });
    }
    return;
  }

  throw new Error(`unknown fixture command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`${serializeError(error).message}\n`);
  process.exitCode = 1;
});
