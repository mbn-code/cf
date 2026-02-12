# Contributing to cf Toolkit

First off, thanks for taking the time to contribute! Contributions are what make the open-source community such an amazing place to learn, inspire, and create.

## How Can I Contribute?

### Reporting Bugs
- Use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.yml).
- Provide a clear and concise description of the bug.
- Include reproduction steps and your environment details.

### Suggesting Enhancements
- Use the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.yml).
- Explain why the feature would be useful.

### Pull Requests
1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes.
4. Make sure your code follows the existing style.
5. Write a clear title and description for your pull request.

> [!IMPORTANT]
> Always run `npm run lint` and `npm run build` in the `web` directory before submitting a PR to catch any TypeScript or styling errors.

## Development Setup

### CLI Development
The core logic resides in `scripts/`. If you modify `cf`, `test.sh`, or `build.sh`, make sure to test them across different problem structures.

> [!WARNING]
> Be careful when modifying the `cf` script's path resolution logic, as it needs to work for both local clones and global installations.

```bash
# Test the CLI locally
./scripts/cf --version
```

### Web Interface Development
The web interface is built with **Next.js 15**, **Tailwind CSS 4**, and **Shadcn UI**.

```bash
cd web
npm install
npm run dev
```

The web interface communicates with the local filesystem via API routes in `web/app/api/`.

## Project Structure

- `scripts/`: Core bash tools.
- `web/`: Next.js web workbench.
- `src/`: User solutions area.
- `templates/`: C++ algorithm templates.
- `include/`: Shared C++ headers.
- `tests/`: Automated test suite for the toolkit itself.

## Style Guidelines

### Bash
- Use `[[ ]]` instead of `[ ]` for conditions.
- Quote variables to prevent word splitting.
- Use meaningful names for functions.

### C++
- Follow the patterns in `src/template.cpp`.
- Use modern C++ features (C++20/23).
- Keep performance in mind (Fast I/O, efficient algorithms).

### TypeScript/React
- Use functional components and hooks.
- Follow Tailwind CSS best practices.
- Ensure components are accessible.

## Commit Messages
We follow a simple convention for commit messages:
- `feat:` for new features.
- `fix:` for bug fixes.
- `docs:` for documentation changes.
- `refactor:` for code changes that neither fix a bug nor add a feature.
- `chore:` for updating build tasks, etc.

Example: `feat: add support for interactive problems in web UI`

## Code of Conduct
Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.
