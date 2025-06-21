import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      // Generated Prisma files
      "**/generated/**",
      "**/prisma/generated/**",
      "src/generated/**",
      
      // Build and distribution files
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      
      // Node modules
      "node_modules/**",
      
      // Other generated files
      "**/*.d.ts",
      "**/*.js.map",
      "**/*.d.ts.map",
      
      // Specific problematic files
      "**/wasm.js",
      "**/react-native.js",
      "**/runtime/**/*.js"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Relax rules for better compatibility
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-require-imports": "warn",
      "prefer-const": "warn",
      "no-var": "warn",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
];

export default eslintConfig;
