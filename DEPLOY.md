# 🚀 Guia de Deploy — M365 Manager em Produção (Linux)

> Guia completo para migrar o sistema do Windows para um servidor Linux.
> Escrito para quem não tem experiência com Linux — todos os comandos estão prontos para copiar e colar.

---

## 📋 Requisitos do Servidor

| Item | Mínimo | Recomendado |
|------|--------|-------------|
| CPU | 2 vCPUs | 4 vCPUs |
| RAM | 2 GB | 4 GB |
| Disco | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Acesso | SSH root ou sudo | SSH root ou sudo |

---

## 🗂️ Índice

1. [Acesso ao servidor](#1-acesso-ao-servidor)
2. [Atualizar o sistema](#2-atualizar-o-sistema)
3. [Instalar Node.js 20](#3-instalar-nodejs-20)
4. [Instalar PostgreSQL 16](#4-instalar-postgresql-16)
5. [Instalar PowerShell 7 (para Exchange)](#5-instalar-powershell-7)
6. [Instalar módulo Exchange Online](#6-instalar-módulo-exchange-online)
7. [Instalar Nginx](#7-instalar-nginx)
8. [Instalar PM2 (gerenciador de processos)](#8-instalar-pm2)
9. [Transferir os arquivos do projeto](#9-transferir-os-arquivos-do-projeto)
10. [Configurar o banco de dados](#10-configurar-o-banco-de-dados)
11. [Configurar o backend](#11-configurar-o-backend)
12. [Build do frontend](#12-build-do-frontend)
13. [Configurar Nginx](#13-configurar-nginx)
14. [Iniciar com PM2](#14-iniciar-com-pm2)
15. [Configurar SSL (HTTPS)](#15-configurar-ssl-https)
16. [Firewall](#16-firewall)
17. [Atualizar o Azure com a nova URL](#17-atualizar-o-azure-com-a-nova-url)
18. [Verificação final](#18-verificação-final)
19. [Comandos úteis do dia a dia](#19-comandos-úteis-do-dia-a-dia)

---

## 1. Acesso ao servidor

Conecte via SSH do seu computador Windows. Abra o **PowerShell** ou **CMD**:

```bash
ssh root@IP_DO_SEU_SERVIDOR
```

> Substitua `IP_DO_SEU_SERVIDOR` pelo IP real. Ex: `ssh root@192.168.1.100`

Se for a primeira vez, vai perguntar se confia no servidor. Digite `yes` e pressione Enter.

---

## 2. Atualizar o sistema

```bash
apt update && apt upgrade -y
```

Instalar ferramentas essenciais:

```bash
apt install -y curl wget git unzip build-essential software-properties-common
```

---

## 3. Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verificar instalação:

```bash
node --version
# Deve mostrar: v20.x.x

npm --version
# Deve mostrar: 10.x.x
```

---

## 4. Instalar PostgreSQL 16

```bash
apt install -y postgresql postgresql-contrib
```

Iniciar e habilitar para iniciar automaticamente:

```bash
systemctl start postgresql
systemctl enable postgresql
```

Verificar se está rodando:

```bash
systemctl status postgresql
# Deve mostrar: active (running)
```

Acessar o PostgreSQL e criar o banco:

```bash
sudo -u postgres psql
```

Dentro do PostgreSQL, execute estes comandos um por um:

```sql
-- Criar o banco de dados
CREATE DATABASE m365_manager;

-- Definir senha do usuário postgres
ALTER USER postgres WITH PASSWORD 'Vsi@#$3303Vsi';

-- Sair
\q
```

Testar a conexão:

```bash
psql -U postgres -h localhost -d m365_manager -c "SELECT version();"
```

> Se pedir senha, digite: `Vsi@#$3303Vsi`

---

## 5. Instalar PowerShell 7

Necessário para gerenciar permissões de mailbox Exchange Online.

```bash
# Baixar e instalar repositório Microsoft
wget -q "https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb"
dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb

# Instalar PowerShell
apt update
apt install -y powershell
```

Verificar:

```bash
pwsh --version
# Deve mostrar: PowerShell 7.x.x
```

---

## 6. Instalar módulo Exchange Online

```bash
pwsh -Command "Install-Module -Name ExchangeOnlineManagement -Force -AllowClobber -Scope AllUsers"
```

Verificar:

```bash
pwsh -Command "Get-Module -ListAvailable ExchangeOnlineManagement | Select-Object Name, Version"
```

---

## 7. Instalar Nginx

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

Verificar:

```bash
systemctl status nginx
# Deve mostrar: active (running)
```

---

## 8. Instalar PM2

PM2 mantém o backend rodando mesmo após reiniciar o servidor.

```bash
npm install -g pm2
```

Configurar PM2 para iniciar automaticamente:

```bash
pm2 startup
```

> O comando vai mostrar uma linha para copiar e executar. Execute ela.

---

## 9. Transferir os arquivos do projeto

### Opção A — Via Git (recomendado se tiver repositório)

```bash
cd /var/www
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git m365-manager
```

### Opção B — Via SCP (copiar do Windows para o servidor)

No seu computador Windows, abra o **PowerShell** e execute:

```powershell
# Substitua o caminho e o IP
scp -r "C:\Users\Douglas\Desktop\SAAS-NOVO\*" root@IP_DO_SERVIDOR:/var/www/m365-manager/
```

### Opção C — Via SFTP (FileZilla)

1. Baixe o [FileZilla](https://filezilla-project.org/)
2. Conecte: Host `IP_DO_SERVIDOR`, Usuário `root`, Porta `22`
3. Copie a pasta `SAAS-NOVO` para `/var/www/m365-manager/`

---

Após transferir, ajustar permissões:

```bash
chown -R www-data:www-data /var/www/m365-manager
chmod -R 755 /var/www/m365-manager
```

---

## 10. Configurar o banco de dados

Entrar na pasta do projeto:

```bash
cd /var/www/m365-manager/backend
```

Instalar dependências:

```bash
npm install --production
```

Criar o arquivo `.env` de produção:

```bash
nano .env
```

Cole o conteúdo abaixo (ajuste os valores marcados com `<<<`):

```env
PORT=3005
NODE_ENV=production

# Banco de dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=m365_manager
DB_USER=postgres
DB_PASSWORD="Vsi@#$3303Vsi"

# JWT — TROQUE por uma string longa e aleatória!
JWT_SECRET=<<<GERE_UMA_CHAVE_SEGURA_AQUI>>>
JWT_EXPIRES_IN=1h

# Chave de criptografia — EXATAMENTE 32 caracteres
ENCRYPTION_KEY=<<<32_CARACTERES_ALEATORIOS_AQUI>>>

# Azure App Registration
AZURE_CLIENT_ID=SEU_CLIENT_ID_AQUI
AZURE_CLIENT_SECRET=SEU_CLIENT_SECRET_AQUI

# IMPORTANTE: trocar pelo domínio real do servidor
AZURE_REDIRECT_URI=https://SEU_DOMINIO.com/api/auth/microsoft/callback
FRONTEND_URL=https://SEU_DOMINIO.com
```

> Para salvar no nano: `Ctrl+X` → `Y` → `Enter`

Gerar chaves seguras (execute e copie os resultados para o .env):

```bash
# Gerar JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Gerar ENCRYPTION_KEY (32 chars)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Rodar as migrations (criar tabelas):

```bash
npm run migrate
```

> Deve mostrar: `Migrations completed successfully!`
> E: `Default admin created: admin@m365manager.local / Admin@123456`

---

## 11. Configurar o backend

Ainda na pasta `/var/www/m365-manager/backend`, testar se inicia:

```bash
node src/index.js
```

Deve mostrar:
```
✅ M365 Manager Backend running on http://localhost:3005
```

Pressione `Ctrl+C` para parar (vamos usar PM2 depois).

---

## 12. Build do frontend

```bash
cd /var/www/m365-manager/frontend
npm install
npm run build
```

> Isso cria a pasta `build/` com os arquivos estáticos otimizados.
> Pode demorar 2-3 minutos.

---

## 13. Configurar Nginx

Criar o arquivo de configuração:

```bash
nano /etc/nginx/sites-available/m365-manager
```

Cole o conteúdo abaixo (substitua `SEU_DOMINIO.com` pelo seu domínio ou IP):

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO.com www.SEU_DOMINIO.com;

    # Frontend (React build)
    root /var/www/m365-manager/frontend/build;
    index index.html;

    # Servir arquivos estáticos
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para o backend Node.js
    location /api/ {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    # Logs
    access_log /var/log/nginx/m365-manager.access.log;
    error_log /var/log/nginx/m365-manager.error.log;
}
```

Ativar o site:

```bash
ln -s /etc/nginx/sites-available/m365-manager /etc/nginx/sites-enabled/
```

Remover o site padrão:

```bash
rm -f /etc/nginx/sites-enabled/default
```

Testar a configuração:

```bash
nginx -t
# Deve mostrar: syntax is ok / test is successful
```

Reiniciar Nginx:

```bash
systemctl restart nginx
```

---

## 14. Iniciar com PM2

```bash
cd /var/www/m365-manager/backend
pm2 start src/index.js --name "m365-backend" --env production
```

Salvar para reiniciar automaticamente:

```bash
pm2 save
```

Verificar se está rodando:

```bash
pm2 status
# Deve mostrar: m365-backend | online
```

Ver logs em tempo real:

```bash
pm2 logs m365-backend
```

---

## 15. Configurar SSL (HTTPS)

SSL é obrigatório para o OAuth do Microsoft 365 funcionar em produção.

Instalar Certbot:

```bash
apt install -y certbot python3-certbot-nginx
```

Gerar certificado (substitua pelo seu domínio):

```bash
certbot --nginx -d SEU_DOMINIO.com -d www.SEU_DOMINIO.com
```

> Vai pedir seu email e aceitar os termos. Digite `Y` quando perguntado.

O Certbot atualiza o Nginx automaticamente com HTTPS.

Renovação automática (já configurada, mas teste):

```bash
certbot renew --dry-run
```

---

## 16. Firewall

Configurar o firewall para permitir apenas as portas necessárias:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

Verificar:

```bash
ufw status
```

Deve mostrar:
```
OpenSSH    ALLOW
Nginx Full ALLOW
```

---

## 17. Atualizar o Azure com a nova URL

Agora que o sistema está em produção com HTTPS, atualize o Azure:

1. Acesse [portal.azure.com](https://portal.azure.com)
2. **Azure Active Directory → Registros de aplicativo → M365 Manager**
3. **Autenticação → URIs de redirecionamento**
4. Adicione: `https://SEU_DOMINIO.com/api/auth/microsoft/callback`
5. Salve

Também atualize o `.env` do backend:

```bash
nano /var/www/m365-manager/backend/.env
```

Altere:
```env
AZURE_REDIRECT_URI=https://SEU_DOMINIO.com/api/auth/microsoft/callback
FRONTEND_URL=https://SEU_DOMINIO.com
```

Reiniciar o backend:

```bash
pm2 restart m365-backend
```

---

## 18. Verificação final

Testar se tudo está funcionando:

```bash
# Backend respondendo
curl http://localhost:3005/api/health

# Deve retornar: {"status":"ok","port":"3005",...}
```

```bash
# Nginx servindo o frontend
curl -I http://SEU_DOMINIO.com

# Deve retornar: HTTP/1.1 200 OK
```

Acesse no navegador: `https://SEU_DOMINIO.com`

Login padrão:
- **Email:** `admin@m365manager.local`
- **Senha:** `Admin@123456`

> ⚠️ Troque a senha do admin imediatamente após o primeiro login!

---

## 19. Comandos úteis do dia a dia

### PM2 — Gerenciar o backend

```bash
pm2 status                    # Ver status de todos os processos
pm2 logs m365-backend         # Ver logs em tempo real
pm2 logs m365-backend --lines 100  # Ver últimas 100 linhas
pm2 restart m365-backend      # Reiniciar o backend
pm2 stop m365-backend         # Parar o backend
pm2 start m365-backend        # Iniciar o backend
```

### Nginx

```bash
systemctl status nginx        # Ver status
systemctl restart nginx       # Reiniciar
nginx -t                      # Testar configuração
tail -f /var/log/nginx/m365-manager.error.log  # Ver erros
```

### PostgreSQL

```bash
sudo -u postgres psql m365_manager   # Acessar o banco
\dt                                   # Listar tabelas
\q                                    # Sair
```

### Atualizar o sistema (quando houver mudanças no código)

```bash
cd /var/www/m365-manager

# Se usar Git:
git pull

# Atualizar backend
cd backend
npm install --production
pm2 restart m365-backend

# Atualizar frontend
cd ../frontend
npm install
npm run build

# Reiniciar Nginx
systemctl restart nginx
```

### Ver uso de recursos

```bash
htop          # CPU e memória (pressione Q para sair)
df -h         # Espaço em disco
free -h       # Memória RAM
```

---

## 🔒 Checklist de Segurança Pós-Deploy

- [ ] Trocar senha do admin padrão (`admin@m365manager.local`)
- [ ] Verificar que `JWT_SECRET` é único e longo (mínimo 64 chars)
- [ ] Verificar que `ENCRYPTION_KEY` tem exatamente 32 chars
- [ ] SSL/HTTPS ativo e funcionando
- [ ] Firewall configurado (apenas portas 22, 80, 443)
- [ ] Arquivo `.env` com permissões restritas: `chmod 600 /var/www/m365-manager/backend/.env`
- [ ] Backup automático do banco configurado (ver abaixo)

---

## 💾 Backup automático do banco

Criar script de backup:

```bash
nano /usr/local/bin/backup-m365.sh
```

Cole:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/m365-manager"
mkdir -p $BACKUP_DIR
PGPASSWORD="Vsi@#$3303Vsi" pg_dump -U postgres m365_manager > "$BACKUP_DIR/backup_$DATE.sql"
# Manter apenas os últimos 7 backups
ls -t $BACKUP_DIR/backup_*.sql | tail -n +8 | xargs -r rm
echo "Backup concluído: backup_$DATE.sql"
```

Tornar executável:

```bash
chmod +x /usr/local/bin/backup-m365.sh
```

Agendar backup diário às 2h da manhã:

```bash
crontab -e
```

Adicione a linha:

```
0 2 * * * /usr/local/bin/backup-m365.sh >> /var/log/m365-backup.log 2>&1
```

Testar o backup manualmente:

```bash
/usr/local/bin/backup-m365.sh
ls /var/backups/m365-manager/
```

---

## 🆘 Solução de Problemas Comuns

### Backend não inicia

```bash
pm2 logs m365-backend --lines 50
# Leia o erro e verifique o .env
```

### Erro 502 Bad Gateway no Nginx

```bash
# Verificar se o backend está rodando
pm2 status
# Se não estiver: pm2 start m365-backend
```

### Erro de conexão com banco

```bash
# Testar conexão
psql -U postgres -h localhost -d m365_manager -c "SELECT 1"
# Se falhar, verificar se PostgreSQL está rodando:
systemctl status postgresql
```

### Certificado SSL expirado

```bash
certbot renew
systemctl restart nginx
```

### Permissão negada em arquivos

```bash
chown -R www-data:www-data /var/www/m365-manager
chmod -R 755 /var/www/m365-manager
chmod 600 /var/www/m365-manager/backend/.env
```

---

## 📞 Resumo das Versões Instaladas

| Software | Versão | Porta |
|----------|--------|-------|
| Node.js | 20.x LTS | — |
| npm | 10.x | — |
| PostgreSQL | 16.x | 5432 |
| PowerShell | 7.x | — |
| ExchangeOnlineManagement | 3.x | — |
| Nginx | 1.24.x | 80/443 |
| PM2 | latest | — |
| Ubuntu | 22.04 LTS | — |
