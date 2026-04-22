FROM node:20-alpine

# Install PowerShell dependencies
RUN apk add --no-cache \
    ca-certificates \
    less \
    ncurses-terminfo-base \
    krb5-libs \
    libgcc \
    libintl \
    libssl3 \
    libstdc++ \
    tzdata \
    userspace-rcu \
    zlib \
    icu-libs \
    curl

# Install PowerShell
RUN curl -L https://github.com/PowerShell/PowerShell/releases/download/v7.4.6/powershell-7.4.6-linux-musl-x64.tar.gz -o /tmp/powershell.tar.gz \
    && mkdir -p /opt/powershell \
    && tar -xzf /tmp/powershell.tar.gz -C /opt/powershell \
    && ln -s /opt/powershell/pwsh /usr/local/bin/pwsh \
    && rm /tmp/powershell.tar.gz

# Install ExchangeOnlineManagement module
RUN pwsh -Command "Install-Module -Name ExchangeOnlineManagement -Force -AllowClobber -Scope AllUsers -ErrorAction Stop"

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/src ./src

EXPOSE 3005

CMD ["node", "src/index.js"]
