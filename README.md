# ATS - SIA

An Applicant Tracking System built with modern web technologies.

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Linting**: ESLint, Prettier

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database

### Installation

1. Clone the repository or use this boilerplate
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials and other configuration.

4. Set up the database:
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push database schema
   npm run db:push
   
   # (Optional) Seed the database
   npm run db:seed
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed the database

## Project Structure

```
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # Reusable UI components
│   ├── lib/                 # Utility libraries and configurations
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── prisma/                  # Database schema and migrations
├── public/                  # Static assets
└── ...config files
```

## Database

This project uses PostgreSQL with Prisma as the ORM. The database schema is defined in `prisma/schema.prisma`.

## Contributing

1. Follow the existing code style and conventions
2. Run `npm run lint` and `npm run type-check` before committing
3. Write meaningful commit messages

## License

This project is private and proprietary.