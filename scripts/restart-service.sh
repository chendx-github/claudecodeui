#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-claudecodeui}"
PROJECT_DIR="${PROJECT_DIR:-/home/chendx/claudecodeui}"
PM2_HOME="${PM2_HOME:-/home/chendx/.pm2}"
PORT="${PORT:-3001}"
HOST="${HOST:-127.0.0.1}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-30}"

if [[ -f "${PROJECT_DIR}/.env" ]]; then
  HTTPS_ENV="$(grep -E '^HTTPS=' "${PROJECT_DIR}/.env" | tail -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")"
else
  HTTPS_ENV=""
fi

if [[ "${HTTPS_ENV,,}" == "true" || "${HTTPS_ENV}" == "1" ]]; then
  PROTOCOL="https"
  CURL_INSECURE_FLAG="-k"
else
  PROTOCOL="http"
  CURL_INSECURE_FLAG=""
fi

HEALTH_URL="${PROTOCOL}://${HOST}:${PORT}${HEALTH_PATH}"

find_pm2_bin() {
  if command -v pm2 >/dev/null 2>&1; then
    command -v pm2
    return 0
  fi
  if [[ -x "/home/chendx/.nvm/versions/node/v22.22.0/bin/pm2" ]]; then
    echo "/home/chendx/.nvm/versions/node/v22.22.0/bin/pm2"
    return 0
  fi
  return 1
}

PM2_BIN="$(find_pm2_bin || true)"
if [[ -z "${PM2_BIN}" ]]; then
  echo "[ERROR] pm2 command not found. Install PM2 first."
  exit 1
fi

echo "[INFO] Using PM2 binary: ${PM2_BIN}"
echo "[INFO] PM2_HOME: ${PM2_HOME}"
echo "[INFO] Project: ${PROJECT_DIR}"
echo "[INFO] Health URL: ${HEALTH_URL}"

export PM2_HOME

cd "${PROJECT_DIR}"

if "${PM2_BIN}" pid "${APP_NAME}" >/dev/null 2>&1; then
  echo "[INFO] Restarting existing PM2 app: ${APP_NAME}"
  if ! "${PM2_BIN}" restart "${APP_NAME}" --update-env; then
    echo "[WARN] PM2 restart failed. Trying stop/delete/start recovery..."
    "${PM2_BIN}" delete "${APP_NAME}" || true
    "${PM2_BIN}" start npm --name "${APP_NAME}" --cwd "${PROJECT_DIR}" -- run server
  fi
else
  echo "[INFO] PM2 app '${APP_NAME}' not found. Starting new app..."
  "${PM2_BIN}" start npm --name "${APP_NAME}" --cwd "${PROJECT_DIR}" -- run server
fi

echo "[INFO] Waiting for PM2 app status = online..."
for _ in $(seq 1 20); do
  STATUS="$("${PM2_BIN}" jlist | node -e '
    const fs = require("fs");
    const name = process.argv[1];
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const app = data.find(x => x.name === name);
    process.stdout.write(app?.pm2_env?.status || "");
  ' "${APP_NAME}")"
  if [[ "${STATUS}" == "online" ]]; then
    break
  fi
  sleep 1
done

STATUS="$("${PM2_BIN}" jlist | node -e '
  const fs = require("fs");
  const name = process.argv[1];
  const data = JSON.parse(fs.readFileSync(0, "utf8"));
  const app = data.find(x => x.name === name);
  process.stdout.write(app?.pm2_env?.status || "");
' "${APP_NAME}")"

if [[ "${STATUS}" != "online" ]]; then
  echo "[ERROR] PM2 app is not online. Current status: ${STATUS:-unknown}"
  "${PM2_BIN}" status "${APP_NAME}" || true
  "${PM2_BIN}" logs "${APP_NAME}" --lines 120 --nostream || true
  exit 1
fi

echo "[INFO] PM2 app is online. Checking health endpoint..."
HEALTH_OK="false"
for _ in $(seq 1 "${HEALTH_TIMEOUT_SECONDS}"); do
  if curl -fsS ${CURL_INSECURE_FLAG} "${HEALTH_URL}" >/dev/null 2>&1; then
    HEALTH_OK="true"
    break
  fi
  sleep 1
done

if [[ "${HEALTH_OK}" != "true" ]]; then
  echo "[ERROR] Health check failed: ${HEALTH_URL}"
  "${PM2_BIN}" status "${APP_NAME}" || true
  "${PM2_BIN}" logs "${APP_NAME}" --lines 120 --nostream || true
  exit 1
fi

echo "[OK] Service restarted and healthy."
"${PM2_BIN}" status "${APP_NAME}" || true
"${PM2_BIN}" save >/dev/null 2>&1 || true
