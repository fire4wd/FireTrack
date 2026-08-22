#!/bin/bash

# ================================================
# AD - 20260816 - Build e deploy FireTrack Web
# Uso: ./theweb.sh
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
# LOGGING
# ================================================

LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d-%H_%M")
LOG_FILE="$LOG_DIR/deploy_${TIMESTAMP}.log"
ERROR_FILE="$LOG_DIR/deploy_errors_${TIMESTAMP}.log"
SUMMARY_FILE="$LOG_DIR/deploy_summary_${TIMESTAMP}.log"

init_logging() {
    mkdir -p "$LOG_DIR"
    exec 3>&1 4>&2
    exec > >(tee -a "$LOG_FILE") 2>&1
    echo "[$(date +"%Y%m%d-%H:%M:%S")] Deploy started"
}

log() {
    echo "[$(date +"%Y%m%d-%H:%M:%S")] $*"
}

log_error() {
    echo "[$(date +"%Y%m%d-%H:%M:%S")] ERROR: $*" >&2
}

log_summary() {
    echo "[$(date +"%Y%m%d-%H:%M:%S")] $*" >> "$SUMMARY_FILE"
}

cleanup_logging() {
    exec 1>&3 2>&4
}

# ================================================
# FUNZIONI
# ================================================

run() {
    local cmd="$*"
    local output
    output=$(mktemp)

    echo -n "[$(date +"%Y%m%d-%H:%M:%S")] ${STEP_NAME}: > ${cmd} ... "

    if eval "$cmd" >"$output" 2>&1; then
        echo "OK"
    else
        echo "KO"
        cat "$output" >> "$ERROR_FILE"
        rm -f "$output"
        exit 1
    fi

    rm -f "$output"
}

# ================================================
# MAIN
# ================================================

init_logging

STEP_NAME="Build"
log "Building web application"
cd "$PROJECT_DIR"
run npm run build

SUDO_PASS="lasolita"
#read -rsp "Password sudo: " SUDO_PASS
echo

STEP_NAME="Nginx"
log "Configuring nginx on remote server"
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

STEP_NAME="Rsync"
log "Deploying files to remote server"
run rsync -az --delete \
    dist/ \
    "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

STEP_NAME="Systemd"
log "Restarting FireTrack server"
ssh "${REMOTE_USER}@${REMOTE_HOST}" <<ENDSSH
echo '${SUDO_PASS}' | sudo -S systemctl daemon-reload
echo '${SUDO_PASS}' | sudo -S systemctl restart ${SERVICE_NAME}.service
echo '${SUDO_PASS}' | sudo -S systemctl status ${SERVICE_NAME}.service --no-pager
ENDSSH

SERVER_IP=$(ssh "${REMOTE_USER}@${REMOTE_HOST}" "hostname -I | awk '{print \$1}'")

log "Deploy completed successfully"
echo
echo "Locale : https://${SERVER_IP}:7573/"
echo "Pubblico: https://firetrack.net/"

log_summary "Deploy completed to ${REMOTE_HOST}"
log_summary "Local URL: https://${SERVER_IP}:7573/"
log_summary "Public URL: https://firetrack.net/"

cleanup_logging
