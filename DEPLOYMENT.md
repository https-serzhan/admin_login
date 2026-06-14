# Deployment

## Backend: Render

Use the root `render.yaml` Blueprint, or create a Render Web Service manually with:

- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

Set these Render environment variables:

- `JWT_SECRET`: a long random secret
- `FRONTEND_URL`: your Vercel app URL, for example `https://your-app.vercel.app`
- `APP_URL`: your Render backend URL, for example `https://your-api.onrender.com`
- `DB_FILE`: `/var/data/users.db` when using the Render disk
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`: your email provider settings

The Blueprint includes a persistent Render disk mounted at `/var/data` so SQLite data is not lost on deploy.

## Frontend: Vercel

Deploy the `frontend` folder as the Vercel project.

Set this Vercel environment variable:

- `VITE_API_URL`: your Render backend API URL with `/api`, for example `https://your-api.onrender.com/api`

The frontend build output is `dist`.
