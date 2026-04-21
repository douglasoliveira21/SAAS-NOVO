FROM node:20-alpine

# Install PowerShell for Exchange Online management
RUN apk add --no-cache wget ca-certificates \
    && wget -q https://github.com/PowerShell/PowerShell/releases/download/v7.4.1/powershell-7.4.1-linux-musl-x64.tar.gz \
    && mkdir -p /opt/powershell \
    && tar -xzf powershell-7.4.1-linux-musl-x64.tar.gz -C /opt/powershell \
    && ln -s /opt/powershell/pwsh /usr/local/bin/pwsh \
    && rm powershell-7.4.1-linux-musl-x64.tar.gz

# Install ExchangeOnlineManagement module
RUN pwsh -Command "Install-Module -Name ExchangeOnlineManagement -Force -AllowClobber -Scope AllUsers" || true

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3005

CMD ["node", "src/index.js"]
