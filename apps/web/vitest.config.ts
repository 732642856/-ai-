/** @type {import('vite').UserConfig} */
export default {
  test: {
    include: [
      "src/**/*.vitest.test.ts",
      "src/**/*.vitest.test.tsx",
      "src/app/canvas/StarCanvas.split.test.ts",
    ],
    exclude: [
      "node_modules",
      "dist",
      ".turbo",
    ],
  },
};
