# Library management system

The data layer for a library's book catalog. It uses PostgreSQL, Prisma 6 and NestJS. This milestone covers the schema, the migration and a seed script. There are no HTTP endpoints yet beyond the NestJS bootstrap.

## Project layout

```
api/
  prisma/
    schema.prisma     Role enum, User, Genre, Book, Review
    seed.ts           5 genres, 18 books, 2 users, 2 reviews
  src/prisma/
    prisma.service.ts PrismaClient wrapped as a NestJS provider
    prisma.module.ts  Global module that exports PrismaService
  .env.example        DATABASE_URL placeholder
```

## Setup

1. Create a PostgreSQL database on a host such as Neon, Supabase or Railway, and copy its connection string.
2. Install and configure:

```bash
cd api
npm install
cp .env.example .env      # then paste your real DATABASE_URL into .env
```

3. Apply the schema to the hosted database and generate the client:

```bash
npx prisma migrate dev --name init
```

4. Seed the data:

```bash
npx prisma db seed
```

The seed uses upserts, so running it a second time does not create duplicates. Run `npx prisma studio` to browse the tables.

## Schema Decisions

### Why Book references Genre instead of embedding it

A book stores a `genreId` foreign key that points at a row in the `Genre` table. It does not carry a copy of the genre name or description inside the book record. There are four reasons.

A genre is a thing with its own data. It has a name and a description, and the library will want to list genres, count the books in each one, and add new ones without touching any book. That only works if a genre exists as its own row.

Embedding would duplicate the data. If every book held the string "Science Fiction", renaming that genre to "Sci-Fi" would mean updating every matching book, and any book we missed would leave the catalog inconsistent. With a reference, the rename is one update to one row and every book shows the new name.

The foreign key lets the database reject bad data. A book cannot be created with a `genreId` that does not exist, and `onDelete: Restrict` stops someone from deleting a genre that still has books. Free-text genre fields allow typos like "Scifi" and "Science-Fiction" to split one genre into several.

Queries by genre stay simple and fast. The `@@index([genreId])` on `Book` makes "all books in genre X" an indexed lookup, and Prisma can fetch the genre with a book through `include: { genre: true }` when the name is needed.

The tradeoff is that reading a book together with its genre needs a join. For a catalog this size the cost is small, and Prisma handles the join for us.

### Other decisions

`Role` is a Prisma enum with the values `PATRON` and `LIBRARIAN`. PostgreSQL stores it as a native enum type, so the database refuses any other value. New users default to `PATRON`, which means a librarian account has to be assigned on purpose.

`Book` has a compound unique constraint on `(title, author)`. It prevents the same catalog entry from being added twice and gives the seed script a stable key to upsert on. `copiesAvailable` tracks how many physical copies are on the shelf, rather than creating one row per copy, which keeps the first version of the model small. If the library later needs to track individual copies or loans, a `Copy` or `Loan` table can be added without changing `Book`.

`Review` is an extra relation (stretch task). It links one user to one book with a rating and an optional comment. A unique constraint on `(bookId, userId)` allows one review per user per book. Deleting a book or a user cascades to their reviews, because a review is meaningless without either side. The 1 to 5 rating range is checked in application code, since Prisma's schema language has no check constraints.

## Prisma compared with a document database

The biggest difference was that I had to decide the relationships up front. In a document database like MongoDB, I would have been tempted to nest the genre inside each book document and move on, and the shape of the data could have drifted over time. In Prisma, the schema forces me to say that a genre is its own table, that a book must have one, and what happens when either is deleted. It felt slower at the start and safer afterward, because the database enforces those rules and I do not have to rely on every piece of code getting them right.


## Source files

### api/prisma/schema.prisma

```prisma
// Prisma schema for the library book catalog.
// Docs: https://www.prisma.io/docs/orm/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  PATRON
  LIBRARIAN
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  role      Role     @default(PATRON)
  createdAt DateTime @default(now())

  reviews Review[]
}

model Genre {
  id          Int     @id @default(autoincrement())
  name        String  @unique
  description String?

  books Book[]
}

model Book {
  id              Int      @id @default(autoincrement())
  title           String
  author          String
  publishedYear   Int
  copiesAvailable Int      @default(1)
  createdAt       DateTime @default(now())

  // Each book points at exactly one genre row.
  genreId Int
  genre   Genre @relation(fields: [genreId], references: [id], onDelete: Restrict)

  reviews Review[]

  @@unique([title, author])
  @@index([genreId])
}

// Stretch task: a user's rating and comment on a book.
model Review {
  id        Int      @id @default(autoincrement())
  rating    Int // 1 to 5, enforced in application code
  comment   String?
  createdAt DateTime @default(now())

  bookId Int
  book   Book @relation(fields: [bookId], references: [id], onDelete: Cascade)

  userId Int
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)

  // One review per user per book.
  @@unique([bookId, userId])
  @@index([bookId])
}

```

### api/prisma/seed.ts

```ts
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const genres = [
  { name: 'Fiction', description: 'Novels and literary fiction.' },
  { name: 'Science Fiction', description: 'Speculative stories about science, technology and the future.' },
  { name: 'Science', description: 'Popular and academic books on the natural sciences.' },
  { name: 'History', description: 'Narrative and analytical works on the human past.' },
  { name: 'Technology', description: 'Programming, software design and computing.' },
];

const books = [
  // Fiction
  { title: 'Pride and Prejudice', author: 'Jane Austen', publishedYear: 1813, copiesAvailable: 3, genre: 'Fiction' },
  { title: 'To Kill a Mockingbird', author: 'Harper Lee', publishedYear: 1960, copiesAvailable: 4, genre: 'Fiction' },
  { title: 'Nineteen Eighty-Four', author: 'George Orwell', publishedYear: 1949, copiesAvailable: 3, genre: 'Fiction' },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', publishedYear: 1925, copiesAvailable: 2, genre: 'Fiction' },
  // Science Fiction
  { title: 'Dune', author: 'Frank Herbert', publishedYear: 1965, copiesAvailable: 3, genre: 'Science Fiction' },
  { title: 'Neuromancer', author: 'William Gibson', publishedYear: 1984, copiesAvailable: 2, genre: 'Science Fiction' },
  { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', publishedYear: 1969, copiesAvailable: 2, genre: 'Science Fiction' },
  { title: 'Foundation', author: 'Isaac Asimov', publishedYear: 1951, copiesAvailable: 3, genre: 'Science Fiction' },
  // Science
  { title: 'A Brief History of Time', author: 'Stephen Hawking', publishedYear: 1988, copiesAvailable: 3, genre: 'Science' },
  { title: 'Cosmos', author: 'Carl Sagan', publishedYear: 1980, copiesAvailable: 2, genre: 'Science' },
  { title: 'The Selfish Gene', author: 'Richard Dawkins', publishedYear: 1976, copiesAvailable: 2, genre: 'Science' },
  { title: 'Silent Spring', author: 'Rachel Carson', publishedYear: 1962, copiesAvailable: 1, genre: 'Science' },
  // History
  { title: 'Sapiens', author: 'Yuval Noah Harari', publishedYear: 2011, copiesAvailable: 4, genre: 'History' },
  { title: 'Guns, Germs, and Steel', author: 'Jared Diamond', publishedYear: 1997, copiesAvailable: 2, genre: 'History' },
  { title: 'The Guns of August', author: 'Barbara W. Tuchman', publishedYear: 1962, copiesAvailable: 1, genre: 'History' },
  // Technology
  { title: 'The Pragmatic Programmer', author: 'Andrew Hunt and David Thomas', publishedYear: 1999, copiesAvailable: 3, genre: 'Technology' },
  { title: 'Clean Code', author: 'Robert C. Martin', publishedYear: 2008, copiesAvailable: 3, genre: 'Technology' },
  { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', publishedYear: 2017, copiesAvailable: 2, genre: 'Technology' },
];

const users = [
  { email: 'librarian@example.com', name: 'Lena Librarian', role: Role.LIBRARIAN },
  { email: 'patron@example.com', name: 'Paul Patron', role: Role.PATRON },
];

async function main() {
  // Genres first, because every book needs a genreId.
  const genreIds = new Map<string, number>();
  for (const g of genres) {
    const row = await prisma.genre.upsert({
      where: { name: g.name },
      update: { description: g.description },
      create: g,
    });
    genreIds.set(row.name, row.id);
  }

  for (const { genre, ...book } of books) {
    const genreId = genreIds.get(genre)!;
    await prisma.book.upsert({
      where: { title_author: { title: book.title, author: book.author } },
      update: { ...book, genreId },
      create: { ...book, genreId },
    });
  }

  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: u, create: u });
  }

  // A couple of reviews to exercise the Review relation.
  const patron = await prisma.user.findUniqueOrThrow({ where: { email: 'patron@example.com' } });
  const dune = await prisma.book.findFirstOrThrow({ where: { title: 'Dune' } });
  const clean = await prisma.book.findFirstOrThrow({ where: { title: 'Clean Code' } });
  const reviews = [
    { bookId: dune.id, userId: patron.id, rating: 5, comment: 'Dense world-building, worth the length.' },
    { bookId: clean.id, userId: patron.id, rating: 4, comment: 'Useful, though a few examples feel dated.' },
  ];
  for (const r of reviews) {
    await prisma.review.upsert({
      where: { bookId_userId: { bookId: r.bookId, userId: r.userId } },
      update: r,
      create: r,
    });
  }

  const [g, b] = await Promise.all([prisma.genre.count(), prisma.book.count()]);
  console.log(`Seed complete: ${g} genres, ${b} books.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

```

### api/src/prisma/prisma.service.ts

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

```

### api/.env.example

```bash
# Copy this file to .env and replace the placeholder with your own connection string.
# Never commit the real .env file.
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE_NAME?sslmode=require"

```

