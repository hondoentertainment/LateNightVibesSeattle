export default [
  {
    files: ["*.js", "lib/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        console: "readonly",
        FileReader: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        btoa: "readonly",
        atob: "readonly",
        MouseEvent: "readonly",
        HTMLElement: "readonly",
        Intl: "readonly",
        L: "readonly", // Leaflet
        // Node/UMD
        module: "readonly",
        exports: "readonly",
      },
    },
    rules: {
      // Possible errors
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-unsafe-negation": "error",
      "no-constant-condition": "warn",

      // Best practices
      "eqeqeq": ["warn", "smart"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-unused-expressions": "warn",
      "no-useless-return": "warn",
      "no-throw-literal": "warn",

      // Variables
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-shadow-restricted-names": "error",
      "no-use-before-define": ["warn", { functions: false }],

      // Style (light-touch — not enforcing formatting)
      "no-mixed-spaces-and-tabs": "error",
      "no-trailing-spaces": "warn",
      "semi": ["warn", "always"],
    },
  },
  {
    // Test files use ESM
    files: ["tests/**/*.js", "vitest.config.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
  {
    ignores: ["node_modules/**"],
  },
];
