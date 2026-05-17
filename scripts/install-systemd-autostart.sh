#!/usr/bin/env bash
# install-systemd-autostart.sh — enable foundry containers to start on system boot.
#
# This:
#   1. Enables lingering for the current user so user services run without an
#      active login session.
#   2. Enables podman-restart.service so containers with restart: unless-stopped
#      are automatically restarted on boot.
#
# After running this, the foundry stack will come up automatically on reboot
# (assuming you ran `scripts/foundry up` at least once to register the containers).

set -euo pipefail

USER_NAME="${USER:-$(whoami)}"

echo "==> User: $USER_NAME"
echo "==> Step 1/2: enable lingering (allows user services to run pre-login)"
if loginctl show-user "$USER_NAME" 2>/dev/null | grep -q '^Linger=yes'; then
  echo "    already enabled"
else
  echo "    requires sudo:"
  sudo loginctl enable-linger "$USER_NAME"
fi

echo "==> Step 2/2: enable + start podman-restart.service (user)"
systemctl --user enable --now podman-restart.service

echo
echo "==> Done. Verify with:"
echo "    loginctl show-user $USER_NAME | grep Linger"
echo "    systemctl --user status podman-restart.service"
echo
echo "Reboot to test: containers with restart: unless-stopped will come back up."
