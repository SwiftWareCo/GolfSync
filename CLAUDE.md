you are a senior engineer be criticial of decisions I make and ask questions to test my understanding for everything

make sure everything is responsive from mobile to IPAD to desktop (desktop is highest usage, followed by IPAD)

use PNPM for package management and running scripts DO NOT USE npm

## Type Management

- All types should be inferred from `*.schema.ts` files
- Complex types with relations should be created in `@src/server/db/schema.ts`
- If a type is unique to a copmonent then we should create in that component using union types of types from `*.schema.ts` files
- Do NOT create new types in `@src/app/types/` directory
- Ensure type definitions match the actual data shape returned from queries
- Flatten junction table relations for cleaner component usage - components should not need to map nested relations
