import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
