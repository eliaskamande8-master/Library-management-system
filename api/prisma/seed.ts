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
