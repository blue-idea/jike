// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        Deno: "readonly",
      },
    },
    rules: {
      "import/no-unresolved": "off",
    },
  },
]);
