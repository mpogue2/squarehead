# Git Configuration and Usage Guide

## Quick Git Commands for This Project

### Check Status
```bash
git status
git log --oneline --graph --all
```

### Making Changes
```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "Feature: Description of what was added/changed"

# View changes before committing
git diff
git diff --staged
```

### Branching (for new features)
```bash
# Create and switch to new branch
git checkout -b feature/new-feature-name

# Switch back to master
git checkout master

# Merge feature branch
git merge feature/new-feature-name

# Delete feature branch after merge
git branch -d feature/new-feature-name
```

### Useful Aliases (run once to set up)
```bash
git config alias.st status
git config alias.co checkout
git config alias.br branch
git config alias.ci commit
git config alias.unstage 'reset HEAD --'
git config alias.last 'log -1 HEAD'
git config alias.visual '!gitk'
```

### Project-Specific Notes

This repository contains:
- **Frontend**: React SPA in `/frontend/`
- **Backend**: PHP API in `/backend/`
- **Database**: Schema and migrations in `/backend/database/`
- **Documentation**: Detailed docs in `/docs/`

### Files Automatically Ignored
- Database files (*.sqlite, *.db)
- Environment files (.env)
- Node modules
- Vendor directories
- Build outputs
- Log files

### Before Committing
1. Test both frontend and backend servers
2. Ensure no sensitive data (API keys, passwords) in committed files
3. Update documentation if adding new features
4. Use descriptive commit messages

### Commit Message Format
```
Type: Brief description

Examples:
Feature: Add cached coordinates to map page
Fix: Resolve authentication token validation
Update: Improve member CSV import error handling
Docs: Add installation instructions to README
```
