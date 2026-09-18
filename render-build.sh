#!/usr/bin/env bash
set -o errexit
set -o pipefail

curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

cd frontend
npm ci --include=dev
npm run build

cd ../backend
uv export --frozen --no-dev --no-emit-project > requirements.txt
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate