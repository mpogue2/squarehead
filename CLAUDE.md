# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- Frontend: `npm run dev` (dev server), `npm run build` (production)
- Backend: `./run-server.sh` (PHP server on port 8000)
- Lint: `npm run lint` (frontend only)
- Test: `composer test` (backend tests)

Note: The `composer start` command has a 300-second timeout issue. Use `./run-server.sh` instead for longer sessions.

## Code Style Guidelines
- **Frontend**: React functional components with hooks
- **State**: Zustand for state management (`store/*.js`)
- **API**: Axios with interceptors in `services/api.js`
- **Custom hooks**: Follow `use` prefix pattern, export via `hooks/index.js`
- **Error handling**: Try/catch blocks with consistent logging
- **Components**: Feature-based organization, focused on reusability

## Naming & Organization
- React components: PascalCase (.jsx)
- Hooks/utils: camelCase with descriptive names
- Backend: PSR-4 namespacing, strict typing
- API responses: Standardized via `ApiResponse` helper

## Git Practices
- Commit format: `Type: Brief description` (Feature, Fix, Update, Docs)
- Test changes before committing
- Document significant changes in `/docs` directory