# AI Policy

This project embraces AI as a tool but values human expertise and accountability.

## 1. The "Human-in-the-Loop" Mandate
- **Author of Record**: The human contributor is the author of record for all submissions.
- **Responsibility**: Contributors are held responsible for the code's performance, security, and correctness, regardless of whether it was assisted by AI.
- **Review**: 100% of AI-generated or assisted output must be manually vetted, tested, and understood by the contributor before being committed. Do not submit code you cannot explain, modify, or debug yourself.

## 2. Disclosure Requirements
- **Nontrivial Rule**: Disclosure is not required for simple AI-assisted autocomplete (e.g., variable names). However, disclosure is **mandatory** for entire functions, classes, logic blocks, or significant refactors.
- **Tagging Standard**: Use git trailers like `Assisted-by: [Model Name]` or `Co-authored-by: Junie <junie@jetbrains.com>` in commit messages where applicable.
- **No "Slop"**: We strictly forbid "low-effort" submissions where prompts are piped directly to the repository without local testing and verification.

## 3. Permitted vs. Prohibited Uses
- **Permitted**:
  - Writing unit tests and documentation.
  - Generating boilerplate and scaffolding.
  - Refactoring for readability.
  - Fixing grammar and spelling.
- **Prohibited**:
  - AI-generated images, videos, or audio are strictly forbidden.
  - Architectural design decisions or security-sensitive logic should be human-driven.

## 4. Licensing & Intellectual Property
- **Third-Party Rights**: Contributors must ensure AI tools haven't copy-pasted code from differently licensed projects.
- **Provenance**: You must have the right to license the output under this project's MIT license.

## 5. Enforcement
- **Review**: All PRs will be reviewed by humans directly.
- **Closure Policy**: Maintainers reserve the right to close any PR immediately if they suspect undisclosed or unverified AI usage ("slop") that wastes maintainer time.
