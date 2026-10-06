# Tamasha — Event Management & Ticketing Platform

Tamasha is a full-stack event management and ticketing platform designed for discovering events, purchasing tickets, and managing events and attendees.

## Features

* Event discovery, search, and filtering
* Event details and ticket selection
* Ticket checkout and order management
* Digital QR tickets and check-in
* Organizer event and ticket management
* Attendee management and analytics
* Admin moderation
* Role-based access control
* Ticket availability protection against overselling
* Refund and event cancellation handling

## Tech Stack

**Frontend**

* Next.js 15
* TypeScript
* Tailwind CSS

**Backend**

* Node.js
* Express 5
* TypeScript
* Prisma
* PostgreSQL
* Zod

## Architecture

```text
Browser
   ↓
Next.js Frontend (:3000)
   ↓ /api/* proxy
Express API (:4000)
   ↓
Prisma
   ↓
PostgreSQL
```

The frontend and backend are separated into independent applications. Next.js proxies API requests to the backend so authentication remains same-origin.

## Getting Started

### Requirements

* Node.js 20+
* PostgreSQL 14+

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open **http://localhost:3000**.

### Docker

A PostgreSQL instance can also be started with:

```bash
docker compose up -d
```

## Testing

```bash
cd backend
npm test
```

The test suite includes concurrency testing to ensure limited ticket inventory cannot be oversold.

## MVP Notes

Payments and notifications are currently simulated and can be replaced with real payment and messaging providers. The project is structured to allow these integrations without changing the core business logic.
