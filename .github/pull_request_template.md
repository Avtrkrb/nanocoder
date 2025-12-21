## Description

Brief description of what this PR does

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

### Automated Checks

This PR will automatically be checked against:
- **Linting**: Code style and formatting with Biome
- **Type checking**: TypeScript compilation with no errors
- **Unit tests**: Test suite execution with coverage
- **Build verification**: Project builds successfully across platforms
- **Security audit**: No high-severity vulnerabilities (npm audit)
- **Dependency analysis**: No unused dependencies (knip)

### Requirements for Merge

- [ ] New features include passing tests in `.spec.ts/tsx` files
- [ ] All existing tests pass (`pnpm test:all` completes successfully)
- [ ] Tests cover both success and error scenarios
- [ ] Code coverage meets or exceeds 80% threshold
- [ ] No high-severity security vulnerabilities
- [ ] No unused dependencies detected
- [ ] Build succeeds on Ubuntu, Windows, and macOS with Node.js 18, 20, 22

### Manual Testing

- [ ] Tested with Ollama
- [ ] Tested with OpenRouter
- [ ] Tested with OpenAI-compatible API
- [ ] Tested MCP integration (if applicable)

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated (if needed)
- [ ] No breaking changes (or clearly documented)
- [ ] Appropriate logging added using structured logging (see [CONTRIBUTING.md](../CONTRIBUTING.md#logging))
