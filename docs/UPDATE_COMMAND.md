# CF Update Command - Documentation

## Overview

The `cf update` command automatically updates the cf tool to the latest version from the git repository and runs the setup script.

## Usage

```bash
cf update
```

## Features

### Safety Checks

- Verifies the directory is a git repository
- Detects uncommitted changes and prompts for confirmation
- Allows user to cancel update if needed

### Update Process

1. Fetches latest changes from the tracked remote (`origin` by default)
2. Fast-forwards the current branch (`git pull --ff-only`); a diverged
   branch is reported instead of being merged
3. Runs the setup script automatically (skip with `CF_UPDATE_SKIP_SETUP=1`)
4. Returns to the original directory

Run `cf version` afterwards to confirm the new version.

### Error Handling

- Exits with error if not in a git repository
- Fails gracefully if fetch/pull fails
- Warns if setup script is missing or encounters issues
- Preserves user's working directory

## Examples

### Clean Repository

```bash
$ cf update
Info: Updating cf tool to latest version...
Info: Fetching latest changes from remote...
Info: Pulling latest changes...
Success: Repository updated successfully
Info: Running setup script...
Success: Setup completed successfully

Success: cf tool updated to latest version!
Run 'cf help' to see all available commands
```

### With Uncommitted Changes

```bash
$ cf update
Info: Updating cf tool to latest version...
Warning: You have uncommitted changes in the repository
Continue with update? (y/N): n
Info: Update cancelled
```

## Integration

The update command is integrated into:

- Main command dispatcher
- Help documentation
- Usage messages

## Security Considerations

1. **Requires git repository**: Won't run outside of git context
2. **User confirmation**: Prompts before updating with uncommitted changes
3. **Sudo permissions**: Setup script may require sudo for system-wide installation
4. **Source verification**: Only pulls from configured git remote

## Best Practices

- Commit or stash changes before updating
- Review changelog after major updates
- Test in development environment first
- Keep backup of customizations

## Troubleshooting

### Update fails to fetch

```bash
Error: Failed to fetch from remote repository
```

**Solution**: Check internet connection and git remote configuration

### Setup script issues

```bash
Warning: Setup script encountered issues, but update completed
```

**Solution**: Repository updated but setup had problems. Run `./scripts/setup.sh` manually

### Not a git repository

```bash
Error: Not a git repository: /path/to/cf
```

**Solution**: Ensure cf tool was installed via git clone
