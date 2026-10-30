# Contributing

Run `node --test test/*.test.mjs` with Node.js 18 or later and Bash. Tests exercise the shell embedded in `action.yml` using a local scanner stub.

Changes must preserve argument quoting, masked output, failure handling, minimal permissions, and compatibility with the documented CLI version. Add regression tests for behavior changes. Never include a real credential in a test, issue, or pull request.

Keep contributions focused and document changes to inputs, outputs, runtime requirements, or exit behavior. Contributions are accepted under MIT.
