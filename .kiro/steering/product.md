# Product Overview

M365 Manager is a web application for centralized management of multiple Microsoft 365 tenants. It allows IT administrators and technicians to manage users, licenses, groups, SharePoint sites, and mailboxes across multiple client tenants — without needing separate browser profiles or logins for each tenant.

## Core Capabilities

- **Tenant management**: Connect M365 tenants via OAuth2 (delegated + app-only), store encrypted tokens, validate connections
- **User management**: List, create, block, reset passwords, revoke sessions, manage MFA methods
- **License management**: View availability, assign and remove licenses per user
- **Group management**: Create security/M365 groups, manage members and owners
- **SharePoint**: Browse sites, drives, folders; manage site and item-level permissions
- **Mailbox**: List mailboxes, manage SendAs/SendOnBehalf/FullAccess delegations, create shared mailboxes
- **Risk control**: Tiered confirmation system (low/medium/high/critical) for sensitive actions
- **Audit logging**: All actions are logged with user, tenant, risk level, and IP
- **Approvals**: Critical actions require admin approval before execution
- **RBAC**: Two roles — `admin` (full access) and `tecnico` (restricted to assigned tenants)

## Language

The product UI and backend error messages are in **Brazilian Portuguese**. Code comments and variable names are in English.
