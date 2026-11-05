/**
 * @file OpenAPI document. The web client is generated from its export (docs/04 §5).
 */
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Hub API')
    .setVersion('1')
    .addBearerAuth()
    .addCookieAuth('hub_access')
    .build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}
