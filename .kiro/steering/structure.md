# Project Structure

```
m365-manager/
├── backend/
│   └── src/
│       ├── db/
│       │   ├── database.js      # pg Pool singleton — import this for all DB queries
│       │   └── migrate.js       # DDL migrations + seeds default admin user
│       ├── middleware/
│       │   └── auth.js          # authenticate (JWT), requireAdmin, requireTenantAccess
│       ├── routes/
│       │   ├── auth.js          # login, /me, user CRUD
│       │   ├── users.js         # system user management
│       │   ├── tenants.js       # tenant CRUD, connect/validate
│       │   ├── m365.js          # all Graph-backed operations (users, licenses, groups, SP, mailbox)
│       │   ├── oauthCallback.js # Microsoft OAuth2 callback handler
│       │   ├── risk.js          # risk approval queue endpoints
│       │   └── audit.js         # audit log queries
│       ├── services/
│       │   ├── graphService.js  # all Microsoft Graph API calls (single source of truth)
│       │   └── exchangeService.js
│       └── utils/
│           ├── audit.js         # log() helper — call after every sensitive action
│           ├── crypto.js        # encrypt()/decrypt() using AES + ENCRYPTION_KEY
│           └── riskControl.js   # RISK_ACTIONS map, getRisk(), isHighRisk()
└── frontend/
    └── src/
        ├── api/
        │   └── client.js        # axios instance with Bearer token interceptor
        ├── context/
        │   └── AuthContext.js   # useAuth() hook — user, login, logout, isAdmin
        ├── hooks/
        │   └── useRiskAction.js # wraps risky mutations with confirmation modal
        ├── utils/
        │   └── riskDefinitions.js # frontend mirror of RISK_ACTIONS
        ├── components/
        │   ├── Layout.js        # sidebar + outlet wrapper
        │   ├── GlobalSearch.js
        │   ├── RiskConfirmModal.js  # confirmation dialog for medium/high/critical actions
        │   └── tenant/          # tab components rendered inside TenantDetailPage
        │       ├── UsersTab.js
        │       ├── LicensesTab.js
        │       ├── GroupsTab.js
        │       ├── SharePointTab.js
        │       ├── MailboxTab.js
        │       ├── BatchPanel.js
        │       └── CreateUserWizard.js
        └── pages/
            ├── LoginPage.js
            ├── DashboardPage.js
            ├── TenantsPage.js
            ├── TenantDetailPage.js  # hosts all tenant/* tab components
            ├── UsersPage.js         # admin-only: system users
            ├── AuditPage.js         # admin-only
            └── ApprovalsPage.js     # admin-only: critical action approval queue
```

## Key Architectural Patterns

### Backend

- All routes apply `authenticate` middleware first; use `requireAdmin` or `requireTenantAccess` as needed
- All Microsoft Graph calls go through `graphService.js` — never call Graph directly from routes
- `graphService.getValidToken()` handles token refresh transparently before every request
- OAuth tokens are always stored encrypted (`encrypt()`/`decrypt()` from `utils/crypto.js`)
- Every mutating action must call `audit.log()` with `userId`, `tenantId`, `action`, `riskLevel`
- Risk levels come from `RISK_ACTIONS` in `utils/riskControl.js` — add new actions there

### Frontend

- All API calls use the `api` axios instance from `api/client.js` (never raw axios)
- Auth state is consumed via `useAuth()` from `AuthContext` — never read localStorage directly
- Sensitive mutations use `useRiskAction` hook which triggers `RiskConfirmModal` before proceeding
- `isAdmin` from `useAuth()` gates admin-only UI elements
- React Query is used for all server state; invalidate relevant queries after mutations
- Toast notifications via `react-hot-toast` for user feedback on actions
