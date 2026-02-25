#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-claudecodeui}"
PROJECT_DIR="${PROJECT_DIR:-/home/chendx/claudecodeui}"
PM2_HOME="${PM2_HOME:-/home/chendx/.pm2}"
NODE_BIN="${NODE_BIN:-/home/chendx/.local/share/mise/installs/node/24.13.1/bin/node}"
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
  if [[ -x "/home/chendx/.local/share/mise/installs/node/24.13.1/bin/pm2" ]]; then
    echo "/home/chendx/.local/share/mise/installs/node/24.13.1/bin/pm2"
    return 0
  fi
  return 1
}

PM2_BIN="$(find_pm2_bin || true)"
if [[ -z "${PM2_BIN}" ]]; then
  echo "[ERROR] pm2 command not found. Install PM2 first."
  exit 1
fi

if [[ ! -x "${NODE_BIN}" ]]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
  else
    echo "[ERROR] node command not found."
    exit 1
  fi
fi

echo "[INFO] Using PM2 binary: ${PM2_BIN}"
echo "[INFO] Using Node binary: ${NODE_BIN}"
echo "[INFO] PM2_HOME: ${PM2_HOME}"
echo "[INFO] Project: ${PROJECT_DIR}"
echo "[INFO] Health URL: ${HEALTH_URL}"

export PM2_HOME

cd "${PROJECT_DIR}"

if "${PM2_BIN}" pid "${APP_NAME}" >/dev/null 2>&1; then
  echo "[INFO] Recreating existing PM2 app with unified runtime: ${APP_NAME}"
  "${PM2_BIN}" delete "${APP_NAME}" || true
else
  echo "[INFO] PM2 app '${APP_NAME}' not found. Starting new app..."
fi
"${PM2_BIN}" start server/index.js --name "${APP_NAME}" --cwd "${PROJECT_DIR}" --interpreter "${NODE_BIN}"

echo "[INFO] Waiting for PM2 app status = online..."
for _ in $(seq 1 20); do
  STATUS="$("${PM2_BIN}" jlist | "${NODE_BIN}" -e '
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

STATUS="$("${PM2_BIN}" jlist | "${NODE_BIN}" -e '
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
