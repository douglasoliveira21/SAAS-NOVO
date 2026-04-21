# Tech Stack

## Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+ via `pg` (connection pool)
- **Auth**: JWT (`jsonwebtoken`), bcrypt for passwords (`bcryptjs`)
- **Microsoft integration**: `@azure/msal-node` + direct Microsoft Graph API calls via `axios`
- **Security**: `helmet`, `cors`, `express-rate-limit`
- **Crypto**: `crypto-js` (AES encryption for stored OAuth tokens)
- **Other**: `uuid`, `dotenv`

## Frontend

- **Framework**: React 18 (Create React App)
- **Routing**: React Router v6
- **Data fetching**: TanStack React Query v5
- **HTTP client**: Axios (with JWT interceptor, auto-redirect on 401)
- **UI icons**: Lucide React
- **Notifications**: react-hot-toast
- **Proxy**: CRA dev proxy forwards `/api` to `http://localhost:3005`

## Infrastructure

- Docker + Docker Compose (separate containers for frontend and backend)
- Nginx serves the frontend build in production
- PostgreSQL runs as a Docker service

## Common Commands

### Backend
```bash
cd backend
npm install
npm run dev        # development with nodemon
npm start          # production
npm run migrate    # run DB migrations and seed default admin user
```

### Frontend
```bash
cd frontend
npm install
npm start          # development server (port 3000)
npm run build      # production build
```

### Docker
```bash
docker-compose up --build   # build and start all services
docker-compose up -d        # start in background
```

## Environment Variables (backend/.env)

| Variable | Description |
|---|---|
| `PORT` | Backend port (default: 3005) |
| `DB_HOST/PORT/NAME/USER/PASSWORD` | PostgreSQL connection |
| `JWT_SECRET` | Secret for signing JWTs (8h expiry) |
| `ENCRYPTION_KEY` | Exactly 32 chars — used for AES token encryption |
| `AZURE_CLIENT_ID` | Azure app registration client ID |
| `AZURE_CLIENT_SECRET` | Azure app registration secret |
| `AZURE_REDIRECT_URI` | OAuth callback URL |
| `FRONTEND_URL` | CORS allowed origin |
