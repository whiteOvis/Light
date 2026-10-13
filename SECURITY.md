# Security

Found a security problem? Use this repository's GitHub **Security → Report a
vulnerability** page. Please do not post it in a public issue.

Do not share passwords, sign-in data, private details, or attack steps.
Tell us the Light version, Omarchy version, what happened, and safe steps to
show the problem.

Light runs with the signed-in user's normal computer permissions.

Light's editable fields use plain-text TextEdit to avoid automatic clipboard
text reads. Explicit paste uses a separate reader capped at 64 KiB and 1.5
seconds. Native dependency patches provide additional protection for other
Qt inputs in the shared shell. See the
[Qt clipboard hardening notes](security/qt/README.md) for affected source
versions, patches, regression checks, and deployment limitations.
