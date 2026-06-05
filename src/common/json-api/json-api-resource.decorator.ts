import { SetMetadata } from '@nestjs/common';

export const JSON_API_RESOURCE = 'json-api-resource';

export const JsonApiResource = (type: string) =>
  SetMetadata(JSON_API_RESOURCE, type);
