module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup.js"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  collectCoverageFrom: [
    "api/controllers/**/*.js",
    "api/services/**/*.js",
    "api/utils/dimensions.js",
    "api/middlewares/**/*.js",
    "!api/utils/mailer.js",
    "!api/utils/aiWorkflowLogger.js",
    "!api/controllers/globalController.js",
    "!api/controllers/userController.js",
    "!api/middlewares/upload.js",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "html", "lcov"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 90,
      lines: 89,
      statements: 89,
    },
  },
};
