# tsense

## Verification

Always use `bun check` to verify changes. It runs type checking, linting, knip, copy-paste detection, and tests in parallel.

```bash
# correct
bun check

# wrong — never run these individually
tsc
bun test
oxlint
bunx knip
```
