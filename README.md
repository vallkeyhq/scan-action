# Vallkey key scan

Fails the build when an API key is committed. Each key is marked on its line in the pull request, masked so the log never shows it, and listed in the run summary.

It knows the keys of Stripe, OpenAI, Anthropic, Google, GitHub, AWS, Slack and 20 more providers, and skips placeholders and test fixtures.

```yaml
name: API keys
on: [push, pull_request]

permissions:
  contents: read

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: vallkeyhq/scan-action@v1
```

To scan every commit too, fetch the whole history:

```yaml
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: vallkeyhq/scan-action@v1
        with:
          history: true
```

| Input | Default | |
| --- | --- | --- |
| `path` | `.` | The folder to scan |
| `history` | `false` | Also scan every commit |
| `fail` | `true` | Fail the job when keys are found |
| `version` | `0.3.1` | The version of the [vallkey](https://www.npmjs.com/package/vallkey) tool to run |

The output `found` is the number of keys found.

A line that only looks like a key can be skipped with a `vallkey:ignore` comment on it.

## Found a key?

A key in a commit is leaked, even if a later commit removes it: create a new key at the provider and revoke the old one. Then keep it out of the code with [Vallkey](https://vallkey.com): `npx vallkey init` swaps the keys in your `.env` files for ghost keys that only work within your rules.
