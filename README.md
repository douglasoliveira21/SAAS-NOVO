# M365 Manager — Gerenciamento Centralizado de Tenants Microsoft 365

Sistema web para gerenciar múltiplos tenants M365 sem necessidade de múltiplos logins ou perfis de navegador.

---

## Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- Conta no Azure com permissão para registrar aplicativos

---

## 1. Configurar App no Azure (OBRIGATÓRIO)

### Registrar o aplicativo:

1. Acesse [portal.azure.com](https://portal.azure.com)
2. **Azure Active Directory → Registros de aplicativo → Novo registro**
3. Nome: `M365 Manager`
4. Tipos de conta: **Contas em qualquer diretório organizacional (Multilocatário)**
5. URI de redirecionamento: `http://localhost:3001/api/auth/microsoft/callback`
6. Clique em **Registrar**

### Configurar permissões da API:

1. Vá em **Permissões de API → Adicionar uma permissão → Microsoft Graph → Permissões de aplicativo**
2. Adicione:
   - `User.ReadWrite.All`
   - `Group.ReadWrite.All`
   - `Directory.ReadWrite.All`
   - `Sites.ReadWrite.All`
3. Clique em **Conceder consentimento do administrador**

### Criar segredo do cliente:

1. Vá em **Certificados e segredos → Novo segredo do cliente**
2. Copie o **Valor** (só aparece uma vez)

### Copiar credenciais:

- **ID do aplicativo (cliente)** → `AZURE_CLIENT_ID`
- **Segredo criado** → `AZURE_CLIENT_SECRET`

---

## 2. Configurar Backend

```bash
cd backend
npm install
```

Edite o arquivo `backend/.env`:

```env
AZURE_CLIENT_ID=cole_aqui_o_client_id
AZURE_CLIENT_SECRET=cole_aqui_o_client_secret
AZURE_REDIRECT_URI=http://localhost:3001/api/auth/microsoft/callback
FRONTEND_URL=http://localhost:3000
```

### Criar banco de dados e rodar migrations:

```bash
# Criar o banco (via psql ou pgAdmin)
createdb -U postgres m365_manager

# Rodar migrations
npm run migrate
```

Isso cria as tabelas e o usuário admin padrão:
- **Email:** `admin@m365manager.local`
- **Senha:** `Admin@123456`

---

## 3. Configurar Frontend

```bash
cd frontend
npm install
```

---

## 4. Iniciar o sistema

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm start
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## Fluxo de uso

### 1. Login no sistema
Use as credenciais do admin padrão ou crie novos usuários.

### 2. Criar uma instância (tenant)
- Vá em **Instâncias → Nova Instância**
- Informe o nome da empresa e o **Tenant ID** do cliente
  - O Tenant ID está em: portal.azure.com → Azure AD → Visão geral

### 3. Conectar o Microsoft 365
- Na lista de instâncias, clique em **Conectar**
- Você será redirecionado para o login Microsoft do cliente
- O admin do cliente deve fazer login e conceder as permissões
- Após autorizar, o sistema salva os tokens automaticamente

### 4. Validar a conexão
- Clique em **Validar** na página da instância
- O sistema testa listando usuários e licenças

### 5. Gerenciar
- **Usuários:** listar, criar, bloquear, redefinir senha
- **Licenças:** ver disponibilidade, atribuir/remover
- **Grupos:** criar grupos de segurança e M365, gerenciar membros
- **SharePoint:** listar sites e bibliotecas, adicionar membros

---

## Estrutura do projeto

```
m365-manager/
├── backend/
│   ├── src/
│   │   ├── db/           # Conexão e migrations PostgreSQL
│   │   ├── middleware/   # Auth JWT + RBAC
│   │   ├── routes/       # auth, users, tenants, m365, audit
│   │   ├── services/     # graphService (Microsoft Graph API)
│   │   └── utils/        # crypto, audit logger
│   └── .env
└── frontend/
    └── src/
        ├── api/          # Axios client
        ├── components/   # Layout + tabs (Users, Licenses, Groups, SharePoint)
        ├── context/      # AuthContext
        └── pages/        # Login, Dashboard, Tenants, TenantDetail, Users, Audit
```

---

## Segurança

- Tokens Microsoft armazenados **criptografados** (AES) no banco
- JWT com expiração de 8h
- RBAC: admin vs técnico
- Rate limiting nas rotas
- Logs de auditoria de todas as ações
- Técnicos só acessam instâncias atribuídas a eles

---

## Produção

Para produção, altere no `.env`:
- `JWT_SECRET` — string longa e aleatória
- `ENCRYPTION_KEY` — exatamente 32 caracteres, aleatório
- `AZURE_REDIRECT_URI` — URL real do servidor
- `FRONTEND_URL` — URL real do frontend
- Configure HTTPS
