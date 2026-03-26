# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website with blog, portfolio, and resume features.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Go + Gin + GORM
- **Database**: MySQL 8.0
- **Cache**: Redis
- **Object Storage**: MinIO (S3-compatible)
- **Auth**: GitHub OAuth
- **Deployment**: Docker Compose

## Project Structure

```
.
├── frontend/          # React frontend
├── backend/           # Go backend
├── docker/            # Docker configuration files
├── docker-compose.yml # One-click deployment
└── README.md
```

## Development Commands

### Backend (from backend/ directory)
```bash
go mod tidy          # Install dependencies
go run main.go       # Run development server (port 8080)
go test ./...        # Run all tests
```

### Frontend (from frontend/ directory)
```bash
pnpm install         # Install dependencies
pnpm dev             # Run development server
pnpm build          # Build for production
pnpm preview        # Preview production build
```

### Docker
```bash
docker-compose up -d        # Start all services
docker-compose down         # Stop all services
docker-compose logs -f      # View logs
```

## Architecture

### Backend
- Entry point: `backend/main.go`
- Routes defined in `backend/routes/`
- Controllers in `backend/controllers/`
- Models in `backend/models/`
- Middleware in `backend/middleware/`

### Frontend
- Entry point: `frontend/src/main.tsx`
- Views in `frontend/src/views/`
- Components in `frontend/src/components/`
- API calls in `frontend/src/api/`
- Store in `frontend/src/store/`

## Features

- Blog posts with markdown support
- Portfolio/projects showcase
- Resume section
- Comment system
- Admin dashboard
- GitHub OAuth login
- Dark mode support