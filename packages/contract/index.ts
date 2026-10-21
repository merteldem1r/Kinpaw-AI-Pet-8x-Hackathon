// @app/contract: the Zod schemas for every /api/app/v1 route, shared by the web
// (which validates input and output with them) and the app (which parses every
// response with them). One definition of each shape (docs/rules/mobile-data.md).
export * from './src/v1/common'
export * from './src/v1/config'
export * from './src/v1/profile'
export * from './src/v1/appearance'
export * from './src/v1/pets'
export * from './src/v1/needs'
export * from './src/v1/talk'
export * from './src/v1/memory'
export * from './src/v1/photo'
export * from './src/v1/intro'
export * from './src/v1/greeting'
export * from './src/v1/voice'
export * from './src/v1/friends'
export * from './src/v1/account'
export * from './src/v1/uploads'
export * from './src/v1/endpoints'
