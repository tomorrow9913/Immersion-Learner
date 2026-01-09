# Documentation Organization

This directory contains project documentation organized by purpose and status.

## Directory Structure

### `/docs/completed/`
Contains documentation for completed tasks and resolved issues:
- `implementation_plan.md` - Initial implementation plan
- `race_condition_fixes.md` - Race condition debugging and fixes
- `PERFORMANCE_OPTIMIZATION.md` - HighlightingLayer performance optimization

### `/docs/guides/`
Contains reference guides and documentation:
- `CHROME_EXTENSION_GUIDE.md` - Chrome Extension development guide

### `/` (Root)
Contains essential project documentation:
- `README.md` - Project overview and setup
- `AGENTS.md` - AI agent development guide

## Cleanup Policy

When tasks are completed:
1. Move task-specific documentation to `/docs/completed/`
2. Keep reference guides in `/docs/guides/`
3. Maintain only essential documentation in root directory
4. Review and archive outdated completed documentation

## Adding New Documentation

**For completed tasks:**
```bash
# Move to completed directory
mv task-documentation.md docs/completed/
```

**For reference guides:**
```bash
# Move to guides directory  
mv guide-documentation.md docs/guides/
```

**For essential project docs:**
Keep in root directory only if it's critical for project understanding and setup.