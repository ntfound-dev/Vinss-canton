import type {
  GeneratedOpenMlsWasmModule,
  OpenMlsWasmLoader,
  OpenMlsWasmModule,
} from "./wasm-api.js";

export type GeneratedModuleImporter =
  () => Promise<GeneratedOpenMlsWasmModule>;

/**
 * Loads wasm-bindgen exactly once.
 *
 * The application decides where the generated JS/WASM package lives.
 * This keeps generated artifacts out of the core messaging code.
 */
export function createOpenMlsWasmLoader(
  importer: GeneratedModuleImporter,
  initInput?: unknown,
): OpenMlsWasmLoader {
  let cached:
    | Promise<OpenMlsWasmModule>
    | undefined;

  return () => {
    if (!cached) {
      cached = importer().then(async (module) => {
        if (initInput === undefined) {
          await module.default();
        } else {
          await module.default(initInput);
        }

        return module;
      });
    }

    return cached;
  };
}
