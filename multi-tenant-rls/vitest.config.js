import { defineConfig } from "vitest/config";

// Os testes usam o mesmo banco, então rodam um arquivo de cada vez.
export default defineConfig({ test: { fileParallelism: false } });
