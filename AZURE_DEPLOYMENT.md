# Azure Deployment Guide

This repository is configured for:
- Backend: Azure App Service (Node.js)
- Frontend: Azure Static Web Apps (Vite build)

## 1) Create Azure resources

1. Create an Azure App Service (Linux, Node 20) for backend.
2. Create an Azure Static Web App for frontend.

## 2) Configure GitHub secrets and variables

Set these in GitHub repository settings.

### Secrets
- `AZURE_WEBAPP_NAME`: Your backend App Service name.
- `AZURE_WEBAPP_PUBLISH_PROFILE`: Publish profile XML from App Service.
- `AZURE_STATIC_WEB_APPS_API_TOKEN`: Deployment token from Static Web App.

### Variables
- `FRONTEND_VITE_API_URL`: Public backend API base URL, for example:
  - `https://<your-backend-app>.azurewebsites.net/api`

## 3) Configure backend App Service application settings

In App Service -> Configuration -> Application settings:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (optional, default `8h`)
- `PORT` (optional; Azure sets this automatically)

Use [backend/.env.azure.example](backend/.env.azure.example) as reference.

## 4) Database migration (Supabase)

Run these SQL files in Supabase SQL editor:

1. [backend/db/schema.sql](backend/db/schema.sql)
2. [backend/db/seed.sql](backend/db/seed.sql) (optional seed/demo data)

## 5) Deployment workflows

Two GitHub Actions workflows are included:

- [deploy backend](.github/workflows/deploy-backend-appservice.yml)
- [deploy frontend](.github/workflows/deploy-frontend-swa.yml)

They trigger on push to `main` for their respective folders.

## 6) Post-deploy checks

1. Open backend health:
   - `https://<backend-app>.azurewebsites.net/api/health`
2. Open frontend URL from Static Web Apps.
3. Verify login and map APIs.

## Notes

- There is no `package.json` at repo root by design; each service has its own package file.
- Workflows deploy from service folders (`backend`, `frontend`).
