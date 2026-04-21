# 🚀 Deploy no EasyPanel — M365 Manager

> Guia completo para subir o M365 Manager no EasyPanel.
> O EasyPanel é um painel visual que gerencia containers Docker no seu servidor — muito mais simples que configurar tudo manualmente.

---

## 📋 O que você vai precisar

- Um servidor VPS com **Ubuntu 22.04** (mínimo 2GB RAM)
- Um domínio apontando para o IP do servidor (ex: `m365.suaempresa.com`)
- O EasyPanel instalado no servidor
- Os arquivos do projeto M365 Manager
- Conta no [Docker Hub](https://hub.docker.com) (gratuita) — para publicar as imagens

---

## 🗂️ Índice

1. [Instalar o EasyPanel no servidor](#1-instalar-o-easypanel-no-servidor)
2. [Acessar o painel](#2-acessar-o-painel)
3. [Criar o projeto](#3-criar-o-projeto)
4. [Subir as imagens Docker](#4-subir-as-imagens-docker)
5. [Criar o serviço PostgreSQL](#5-criar-o-serviço-postgresql)
6. [Criar o serviço Backend](#6-criar-o-serviço-backend)
7. [Criar o serviço Frontend](#7-criar-o-serviço-frontend)
8. [Rodar as migrations](#8-rodar-as-migrations)
9. [Configurar domínio e SSL](#9-configurar-domínio-e-ssl)
10. [Atualizar o Azure](#10-atualizar-o-azure)
11. [Verificação final](#11-verificação-final)
12. [Atualizar o sistema](#12-atualizar-o-sistema)

---

## 1. Instalar o EasyPanel no servidor

Conecte no servidor via SSH:

```bash
ssh root@IP_DO_SEU_SERVIDOR
```

Instalar o EasyPanel com um único comando:

```bash
curl -sSL https://get.easypanel.io | sh
```

> Aguarde alguns minutos. Ao finalizar vai mostrar o endereço de acesso.

---

## 2. Acessar o painel

Abra no navegador:

```
http://IP_DO_SEU_SERVIDOR:3000
```

Na primeira vez vai pedir para criar uma conta de administrador. Crie e faça login.

---

## 3. Criar o projeto

1. No painel do EasyPanel, clique em **"Create Project"**
2. Nome: `m365-manager`
3. Clique em **"Create"**

---

## 4. Subir as imagens Docker

O EasyPanel precisa das imagens Docker do backend e frontend. Você tem duas opções:

---

### Opção A — Build direto pelo EasyPanel (via GitHub) ✅ Recomendado

Se o seu código estiver no GitHub:

1. No serviço, escolha **"App"** → **"GitHub"**
2. Conecte sua conta GitHub
3. Selecione o repositório
4. Configure o caminho do Dockerfile (ex: `./backend/Dockerfile`)

---

### Opção B — Build local e push para Docker Hub

No seu computador Windows, abra o **PowerShell** na pasta do projeto:

**Instalar Docker Desktop** (se não tiver):
- Baixe em: https://www.docker.com/products/docker-desktop/

**Fazer login no Docker Hub:**

```powershell
docker login
```

**Build e push do backend:**

```powershell
# Substitua SEU_USUARIO pelo seu usuário do Docker Hub
docker build -t SEU_USUARIO/m365-backend:latest ./backend
docker push SEU_USUARIO/m365-backend:latest
```

**Build e push do frontend:**

```powershell
docker build -t SEU_USUARIO/m365-frontend:latest ./frontend
docker push SEU_USUARIO/m365-frontend:latest
```

> Aguarde o upload. Pode demorar alguns minutos dependendo da internet.

---

## 5. Criar o serviço PostgreSQL

No EasyPanel, dentro do projeto `m365-manager`:

1. Clique em **"+ Create Service"**
2. Escolha **"Postgres"**
3. Preencha:
   - **Service Name:** `postgres`
   - **Image:** `postgres:16-alpine`
   - **Password:** `Vsi@#$3303Vsi`
   - **Database:** `m365_manager`
   - **User:** `postgres`
4. Clique em **"Create"**

Aguarde ficar verde (Running).

---

## 6. Criar o serviço Backend

1. Clique em **"+ Create Service"**
2. Escolha **"App"**
3. **Service Name:** `backend`
4. Em **"Source"**, escolha:
   - Se usou Docker Hub: **"Docker Image"** → `SEU_USUARIO/m365-backend:latest`
   - Se usou GitHub: **"GitHub"** → selecione o repo e pasta `./backend`
5. **Port:** `3005`

### Configurar variáveis de ambiente

Clique na aba **"Environment"** e adicione uma por uma:

| Variável | Valor |
|----------|-------|
| `PORT` | `3005` |
| `NODE_ENV` | `production` |
| `DB_HOST` | `postgres` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `m365_manager` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | `Vsi@#$3303Vsi` |
| `JWT_SECRET` | *(gere abaixo)* |
| `JWT_EXPIRES_IN` | `1h` |
| `ENCRYPTION_KEY` | *(gere abaixo)* |
| `AZURE_CLIENT_ID` | `SEU_CLIENT_ID_AQUI` |
| `AZURE_CLIENT_SECRET` | `SEU_CLIENT_SECRET_AQUI` |
| `AZURE_REDIRECT_URI` | `https://SEU_DOMINIO.com/api/auth/microsoft/callback` |
| `FRONTEND_URL` | `https://SEU_DOMINIO.com` |

**Gerar JWT_SECRET e ENCRYPTION_KEY** — execute no servidor:

```bash
# JWT_SECRET (cole o resultado na variável)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# ENCRYPTION_KEY (exatamente 32 chars)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

> Se não tiver Node no servidor ainda: `apt install -y nodejs`

6. Clique em **"Deploy"**

---

## 7. Criar o serviço Frontend

1. Clique em **"+ Create Service"**
2. Escolha **"App"**
3. **Service Name:** `frontend`
4. Em **"Source"**:
   - Docker Hub: `SEU_USUARIO/m365-frontend:latest`
   - GitHub: selecione o repo e pasta `./frontend`
5. **Port:** `80`
6. Clique em **"Deploy"**

---

## 8. Rodar as migrations

Após o backend estar **Running**, precisamos criar as tabelas no banco.

No EasyPanel, clique no serviço **backend** → aba **"Console"** (ou "Terminal"):

```bash
node src/db/migrate.js
```

Deve mostrar:
```
Running migrations...
Default admin created: admin@m365manager.local / Admin@123456
Migrations completed successfully!
```

---

## 9. Configurar domínio e SSL

### No serviço Frontend:

1. Clique no serviço **frontend**
2. Aba **"Domains"**
3. Clique em **"Add Domain"**
4. Digite seu domínio: `m365.suaempresa.com`
5. Marque **"HTTPS"** (SSL automático via Let's Encrypt)
6. Clique em **"Save"**

### No serviço Backend (para o callback OAuth):

1. Clique no serviço **backend**
2. Aba **"Domains"**
3. Adicione: `api.m365.suaempresa.com` (ou use o mesmo domínio com path `/api`)
4. Marque **"HTTPS"**

> **Dica:** Se quiser usar o mesmo domínio para frontend e backend (ex: `m365.suaempresa.com` para tudo), configure o frontend para fazer proxy das rotas `/api/*` para o backend. O arquivo `frontend/nginx.conf` já está configurado para isso — o frontend redireciona `/api/` para `http://backend:3005`.

### Apontar o DNS

No painel do seu provedor de domínio (Registro.br, Cloudflare, etc.):

```
Tipo: A
Nome: m365 (ou @ para domínio raiz)
Valor: IP_DO_SEU_SERVIDOR
TTL: 300
```

Aguarde até 10 minutos para propagar.

---

## 10. Atualizar o Azure

Agora que tem HTTPS, atualize o Azure com a URL real:

1. Acesse [portal.azure.com](https://portal.azure.com)
2. **Azure Active Directory → Registros de aplicativo → M365 Manager**
3. **Autenticação → URIs de redirecionamento**
4. Adicione: `https://SEU_DOMINIO.com/api/auth/microsoft/callback`
5. Salve

Atualize também as variáveis de ambiente no EasyPanel (serviço backend):

- `AZURE_REDIRECT_URI` → `https://SEU_DOMINIO.com/api/auth/microsoft/callback`
- `FRONTEND_URL` → `https://SEU_DOMINIO.com`

Após salvar, o EasyPanel reinicia o container automaticamente.

---

## 11. Verificação final

No navegador, acesse: `https://SEU_DOMINIO.com`

Login padrão:
- **Email:** `admin@m365manager.local`
- **Senha:** `Admin@123456`

> ⚠️ Troque a senha imediatamente após o primeiro login!

Testar o backend diretamente:

```
https://SEU_DOMINIO.com/api/health
```

Deve retornar: `{"status":"ok","port":"3005",...}`

---

## 12. Atualizar o sistema

Quando houver atualizações no código:

### Via Docker Hub (Opção B):

No seu computador Windows:

```powershell
# Rebuild e push
docker build -t SEU_USUARIO/m365-backend:latest ./backend
docker push SEU_USUARIO/m365-backend:latest

docker build -t SEU_USUARIO/m365-frontend:latest ./frontend
docker push SEU_USUARIO/m365-frontend:latest
```

No EasyPanel, clique em cada serviço → **"Redeploy"**.

### Via GitHub (Opção A):

Faça `git push` para o repositório. O EasyPanel pode ser configurado para fazer deploy automático a cada push (webhook).

---

## 🔒 Checklist de Segurança

- [ ] Senha do admin padrão trocada
- [ ] `JWT_SECRET` único e longo (mínimo 64 chars)
- [ ] `ENCRYPTION_KEY` com exatamente 32 chars
- [ ] HTTPS ativo no domínio
- [ ] Variáveis de ambiente configuradas (não hardcoded)
- [ ] Backup do PostgreSQL ativado (EasyPanel → serviço postgres → Backups)

---

## 💾 Backup do banco no EasyPanel

O EasyPanel tem backup integrado para PostgreSQL:

1. Clique no serviço **postgres**
2. Aba **"Backups"**
3. Configure:
   - **Schedule:** `0 2 * * *` (todo dia às 2h)
   - **Destination:** S3, Backblaze B2 ou local
4. Clique em **"Save"**

Para backup manual imediato:

1. Aba **"Backups"** → **"Create Backup"**

---

## 🆘 Problemas Comuns

### Container não inicia (vermelho no painel)

1. Clique no serviço → aba **"Logs"**
2. Leia o erro
3. Verifique se todas as variáveis de ambiente estão corretas

### Erro de conexão com banco

- Verifique se `DB_HOST` está como `postgres` (nome do serviço, não IP)
- Verifique se o serviço postgres está **Running** (verde)

### Erro 502 no frontend

- O backend pode não estar rodando
- Verifique os logs do serviço **backend**

### SSL não funciona

- Verifique se o DNS já propagou: `nslookup SEU_DOMINIO.com`
- Aguarde até 10 minutos após configurar o domínio

---

## 📊 Resumo da Arquitetura no EasyPanel

```
Internet
    │
    ▼
EasyPanel (Nginx interno)
    │
    ├── frontend (porta 80) ──── /usr/share/nginx/html (React build)
    │       │
    │       └── /api/* ──────── proxy → backend:3005
    │
    ├── backend (porta 3005) ─── Node.js + Express
    │       │
    │       └── postgres:5432 ── PostgreSQL 16
    │
    └── postgres (porta 5432) ── Banco de dados
```

Todos os serviços se comunicam pela rede interna do Docker — o banco nunca fica exposto para a internet.
