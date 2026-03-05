# Getting Started Guide

## Prerequisites

- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **GitHub Personal Access Token** - [Create one here](https://github.com/settings/tokens)

## Initial Setup

### 1. Install Dependencies

From the project root directory, run:

```bash
npm install
```

This will install all dependencies for both the server and client applications.

### 2. Configure Environment Variables

Create a `.env` file in the project root with your GitHub Personal Access Token:

```bash
GITHUB_PAT=github_pat_xxxxxxxxxxxxx
PORT=3001
HIVE_JDBC_URL=jdbc:hive2://localhost:10000/default
```

**Note**: `HIVE_JDBC_URL` is optional. If not set, the app will use mock data.

## Running the Application

### Option 1: Run Everything Together (Recommended)

Start both the server and client in one command:

```bash
npm run dev
```

This will start:
- **Server** on http://localhost:3001
- **Client** on http://localhost:5173

### Option 2: Run Server and Client Separately

If you need to run them in separate terminal windows:

**Terminal 1 - Start the Server:**
```bash
npm run dev:server
```

**Terminal 2 - Start the Client:**
```bash
npm run dev:client
```

## Stopping and Restarting

### Stopping the Application

To stop the server and client, press `Ctrl + C` in the terminal where they're running.

- If you used `npm run dev`, this will stop both server and client
- If you're running them separately, press `Ctrl + C` in each terminal window

### Restarting the Application

After stopping, simply run the start command again:

```bash
npm run dev
```

**Note**: The development server has hot-reload enabled, so most code changes will automatically refresh without needing to restart. You only need to manually restart if:
- You changed the `.env` file
- You installed new npm packages
- You modified server configuration files
- The application crashed or is behaving unexpectedly

### Background Processes

If the terminal closes unexpectedly and the server is still running in the background, you can find and stop it:

```bash
# Find the process using port 3001 (server)
lsof -i :3001

# Stop it (replace PID with the actual process ID from above)
kill -9 <PID>
```

## Using the Application

1. Open your browser to **http://localhost:5173**
2. Paste or upload your SAS code
3. Click "Translate" to convert to Hive SQL
4. View the results in the Monaco editors

## Common Commands

### Check for TypeScript Errors (Server)
```bash
npx -w packages/server tsc --noEmit
```

### Check for TypeScript Errors (Client)
```bash
npx -w packages/client tsc --noEmit
```

### Install a New Package

For the server:
```bash
npm install <package-name> -w packages/server
```

For the client:
```bash
npm install <package-name> -w packages/client
```

### Health Check

Test if the server is running:
```bash
curl http://localhost:3001/api/health
```

Expected response: `{"status":"ok"}`

## Troubleshooting

### Port Already in Use

If you see an error about port 3001 or 5173 already being in use:

**On macOS/Linux:**
```bash
# Find what's using the port
lsof -i :3001
lsof -i :5173

# Kill the process (replace PID with the actual process ID)
kill -9 <PID>
```

### Missing GitHub Token

If you see GitHub API errors, make sure your `.env` file exists in the project root and contains a valid `GITHUB_PAT`.

### Dependencies Not Installing

Try clearing npm cache and reinstalling:
```bash
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules packages/*/package-lock.json
npm install
```

## Project Structure

```
sas-to-hive-app/
├── packages/
│   ├── server/     # Express API (port 3001)
│   └── client/     # React + Vite app (port 5173)
├── .env            # Your environment variables
└── package.json    # Root workspace configuration
```

## Next Steps

- See the main README for architecture details
- Check `.github/copilot-instructions.md` for development guidelines
- Review example SAS files in the file browser within the app
