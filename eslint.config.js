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
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        console: "readonly",
        FileReader: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        btoa: "readonly",
        atob: "readonly",
        MouseEvent: "readonly",
        HTMLElement: "readonly",
        Intl: "readonly",
        alert: "readonly",
        Notification: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        Event: "readonly",
        Blob: "readonly",
        L: "readonly", // Leaflet
        // Node/UMD
        module: "readonly",
        exports: "readonly",
        require: "readonly",
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
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
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
    // Node config files
    files: ["playwright.config.js", "build.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        process: "readonly",
        __dirname: "readonly",
      },
    },
  },
  {
    files: ["sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
      },
    },
  },
  {
    ignores: ["node_modules/**", ".claude/worktrees/**"],
  },
];
