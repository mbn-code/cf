# CF Update Command - Documentation

## Overview
The `cf update` command automatically updates the cf tool to the latest version from the git repository and runs the setup script.

## Usage
```bash
cf update
```

## Features

### Safety Checks
- ✅ Verifies the directory is a git repository
- ✅ Detects uncommitted changes and prompts for confirmation
- ✅ Allows user to cancel update if needed

### Update Process
1. Fetches latest changes from `origin` remote
2. Pulls changes from `origin/main` branch
3. Runs setup script automatically (if it exists)
4. Returns to original directory

### Error Handling
- Exits with error if not in a git repository
- Fails gracefully if fetch/pull fails
- Warns if setup script is missing or encounters issues
- Preserves user's working directory

## Examples

### Clean Repository
```bash
$ cf update
ℹ Updating cf tool to latest version...
ℹ Fetching latest changes from remote...
ℹ Pulling latest changes...
✓ Repository updated successfully
ℹ Running setup script...
✓ Setup completed successfully

✓ cf tool updated to latest version!
Run 'cf help' to see all available commands
```

### With Uncommitted Changes
```bash
$ cf update
ℹ Updating cf tool to latest version...
⚠ You have uncommitted changes in the repository
Continue with update? (y/N): n
ℹ Update cancelled
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
✗ Error: Failed to fetch from remote repository
```
**Solution**: Check internet connection and git remote configuration

### Setup script issues
```bash
⚠ Setup script encountered issues, but update completed
```
**Solution**: Repository updated but setup had problems. Run `./scripts/setup.sh` manually

### Not a git repository
```bash
✗ Error: Not a git repository: /path/to/cf
```
**Solution**: Ensure cf tool was installed via git clone
