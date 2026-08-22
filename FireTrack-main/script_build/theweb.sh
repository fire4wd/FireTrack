#!/bin/bash

# ================================================
# AD - 20260816 - Build e deploy FireTrack Web
# Uso: ./build_web.sh
# ================================================

set -euo pipefail

# ================================================
# CONFIGURAZIONE
# ================================================

PROJECT_DIR="$HOME/coding/FireTrack"

REMOTE_USER="fire"
REMOTE_HOST="fireux"
REMOTE_PATH="/var/www/html/firetrack"
SERVICE_NAME="firetrack"  # Nome del servizio systemd

# ================================================
# FUNZIONI
# ================================================

run() {

    echo "> $*"

    local LOG
    LOG=$(mktemp)

    if "$@" >"$LOG" 2>&1; then
        echo "OK"
    else
        echo "KO"
        cat "$LOG"
        rm -f "$LOG"
        exit 1
    fi

    rm -f "$LOG"
}

# ================================================
# MAIN
# ================================================

cd "$PROJECT_DIR"

run npm run build
SUDO_PASS="lasolita"
#read -rsp "Password sudo: " SUDO_PASS
echo

echo "> configurazione nginx"

ssh "${REMOTE_USER}@${REMOTE_HOST}" <<ENDSSH
echo '${SUDO_PASS}' | sudo -S mkdir -p ${REMOTE_PATH}
echo '${SUDO_PASS}' | sudo -S chown -R ${REMOTE_USER}:${REMOTE_USER} ${REMOTE_PATH}

echo '${SUDO_PASS}' | sudo -S ln -sf \
    /etc/nginx/sites-available/firetrack \
    /etc/nginx/sites-enabled/firetrack

echo '${SUDO_PASS}' | sudo -S nginx -t
echo '${SUDO_PASS}' | sudo -S systemctl reload nginx

echo '${SUDO_PASS}' | sudo -S ufw allow 7573/tcp 2>/dev/null || true
echo '${SUDO_PASS}' | sudo -S ufw allow 443/tcp 2>/dev/null || true

ENDSSH

echo "OK"

echo "> deploy dei file"

run rsync -az --delete \
    dist/ \
    "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "> restart del server FireTrack"

ssh "${REMOTE_USER}@${REMOTE_HOST}" <<ENDSSH
echo '${SUDO_PASS}' | sudo -S systemctl daemon-reload
echo '${SUDO_PASS}' | sudo -S systemctl restart ${SERVICE_NAME}.service
echo '${SUDO_PASS}' | sudo -S systemctl status ${SERVICE_NAME}.service --no-pager
ENDSSH

SERVER_IP=$(ssh "${REMOTE_USER}@${REMOTE_HOST}" "hostname -I | awk '{print \$1}'")

echo
echo "Locale : https://${SERVER_IP}:7573/"
echo "Pubblico: https://firetrack.net/"
