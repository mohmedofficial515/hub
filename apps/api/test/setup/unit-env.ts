/**
 * @file Env for unit and arch tests. Nothing connects: AppModule is compiled but never initialised.
 */
process.env['NODE_ENV'] = 'test';
process.env['TZ'] = 'UTC';
process.env['LOG_LEVEL'] = 'silent';
process.env['DATABASE_URL'] ??= 'postgresql://unit:unit@localhost:1/unit';
process.env['REDIS_URL'] ??= 'redis://localhost:1/0';
process.env['HUB_SECRET_KEY'] ??= Buffer.alloc(32, 2).toString('base64');
process.env['QUEUE_MODE'] = 'inline';
