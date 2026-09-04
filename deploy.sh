#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# PLESK GIT DAĞITIMI — Vite uygulaması
#
# Plesk'in Git eklentisi her "deploy" sonrasında bu betiği çalıştırır.
# Bağımlılıkları kurar ve dist/ klasörünü derler; alan adının belge kökü
# (document root) dist/ klasörüdür. .env.production derlemeye gömülür.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

export npm_config_cache="${npm_config_cache:-$HOME/.npm}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

echo "▸ npm bağımlılıkları"
npm ci --no-audit --no-fund

echo "▸ Derleme (dist/)"
npm run build

echo "✓ Dağıtım tamamlandı ($(date '+%d.%m.%Y %H:%M'))"
