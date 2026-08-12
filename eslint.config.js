import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

export default [
  {
    files: [
      "src/components/**/*.{js,mjs,cjs,jsx}",
      "src/pages/**/*.{js,mjs,cjs,jsx}",
      "src/Layout.jsx",
    ],
    ignores: ["src/lib/**/*", "src/components/ui/**/*"],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      // The `rules` block below replaces the one that `pluginJs.configs
      // .recommended` spreads in above, which silently switched off `no-undef`
      // — the single rule that catches a reference to something that doesn't
      // exist. A missing `useRef` in an import list shipped a blank screen
      // past both lint and build because of it; esbuild doesn't do
      // undefined-variable analysis either, so nothing was looking.
      "no-undef": "error",
      // `no-undef` does NOT see JSX component references — `<AceBody />` with
      // no import passes it cleanly, because to the base rule that's a JSX
      // element name, not an identifier lookup. Deleting an import while
      // leaving a usage behind therefore sailed through lint AND build, which
      // is the exact shape of the blank screen `no-undef` was turned on for.
      // This is the JSX half of the same rule.
      "react/jsx-no-undef": "error",
      "no-unused-vars": "off",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
