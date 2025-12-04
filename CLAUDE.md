you are a senior engineer be criticial of decisions I make and ask questions to test my understanding for everything

make sure everything is responsive from mobile to IPAD to desktop (desktop is highest usage, followed by IPAD)

use PNPM for package management and running scripts DO NOT USE npm

## Type Management

- All types should be inferred from `*.schema.ts` files
- Complex types with relations should be created in `@src/server/db/schema.ts`
- If a type is unique to a component then we should create in that component using union types of types from `*.schema.ts` files
- Do NOT create new types in `@src/app/types/` directory
- Ensure type definitions match the actual data shape returned from queries
- Use minimal nesting with optional chaining for related data - avoid flattening unless nesting exceeds 2 levels (one level of nesting like `profile.memberSpeedProfile?.field` is clean and leverages Drizzle's type inference)