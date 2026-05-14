#!/usr/bin/env bash
# Lightweight pre-commit secret scanner. Looks for the most common patterns;
# not a substitute for gitleaks/trufflehog but catches the obvious slip-ups.
set -euo pipefail

PATTERNS=(
  'AKIA[0-9A-Z]{16}'                  # AWS access key
  'xox[baprs]-[0-9A-Za-z-]{10,}'      # Slack tokens
  'ghp_[0-9A-Za-z]{36}'               # GitHub PAT
  'gh[oprs]_[0-9A-Za-z]{36}'          # GitHub OAuth
  '-----BEGIN (RSA|EC|PGP|OPENSSH) PRIVATE KEY-----'
)

failed=0
while IFS= read -r file; do
  for pat in "${PATTERNS[@]}"; do
    if grep -E -q "$pat" "$file"; then
      echo "secret-scan: pattern matched in $file (/$pat/)"
      failed=1
    fi
  done
done < <(git diff --cached --name-only --diff-filter=ACM | grep -Ev '\.(lock|svg|png|jpg|gif|pdf|woff2?)$' || true)

exit $failed
