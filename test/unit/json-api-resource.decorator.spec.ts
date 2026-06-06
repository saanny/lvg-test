import { Reflector } from '@nestjs/core';
import {
  JSON_API_RESOURCE,
  JsonApiResource,
} from '../../src/common/json-api/json-api-resource.decorator';

describe('JsonApiResource', () => {
  it('attaches the resource type as metadata on the target', () => {
    @JsonApiResource('users')
    class Sample {}

    expect(new Reflector().get(JSON_API_RESOURCE, Sample)).toBe('users');
  });
});
