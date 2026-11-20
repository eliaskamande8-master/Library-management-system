# Library Management System API

A RESTful backend API for a Library Management System built with **NestJS**, **Prisma ORM**, and **PostgreSQL (Supabase)**, featuring JWT authentication, role-based access control (`MEMBER` vs. `LIBRARIAN`), DTO validation, pagination/filtering, and login rate limiting.

## Tech Stack

* **Framework:** NestJS (TypeScript)
* **ORM & Database:** Prisma ORM + PostgreSQL (Supabase)
* **Authentication & Security:** Passport, JWT (`@nestjs/jwt`), Role Guards, `@nestjs/throttler`
* **Validation:** `class-validator` and `class-transformer` with global `ValidationPipe`
* **API Documentation:** Postman Collection (`docs/postman_collection.json`)

## Project Structure

```text
Library-management-ststem/
├── api/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── auth/
│   │   ├── books/
│   │   ├── genres/
│   │   ├── users/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env
│   ├── .env.example
│   └── package.json
├── docs/
│   └── postman_collection.json
└── README.md