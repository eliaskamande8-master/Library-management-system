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

## Schema decisions

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
