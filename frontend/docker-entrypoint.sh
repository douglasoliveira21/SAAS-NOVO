#!/bin/sh
# Replace placeholder in index.html with actual env var at container startup
API_URL="${REACT_APP_API_URL:-}"
sed -i "s|REACT_APP_API_URL_PLACEHOLDER|${API_URL}|g" /usr/share/nginx/html/index.html
