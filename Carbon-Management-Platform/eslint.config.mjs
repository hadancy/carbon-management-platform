import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "antd",
              importNames: ["message", "notification"],
              message:
                "Use App.useApp() inside a component so feedback uses the current theme context.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='Modal'][callee.property.name=/^(confirm|info|success|error|warning)$/]",
          message:
            "Use the modal instance from App.useApp() instead of a static Modal method.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='Drawer'] > JSXAttribute[name.name='width']",
          message: "Use Drawer size instead of deprecated width.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='Select'] > JSXAttribute[name.name='dropdownRender']",
          message:
            "Use Select popupRender instead of deprecated dropdownRender.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='Space'] > JSXAttribute[name.name='direction']",
          message: "Use Space orientation instead of deprecated direction.",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);
