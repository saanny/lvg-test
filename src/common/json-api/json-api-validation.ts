import { UnprocessableEntityException, ValidationError } from '@nestjs/common';

export interface JsonApiError {
  status: string;
  title: string;
  detail?: string;
  source?: { pointer: string };
}

function collect(errors: ValidationError[], path: string[]): JsonApiError[] {
  return errors.flatMap((error) => {
    const segment =
      error.property === 'atLeastOneField' ? path : [...path, error.property];
    const own = Object.values(error.constraints ?? {}).map((detail) => ({
      status: '422',
      source: { pointer: `/${segment.join('/')}` },
      title: 'Invalid Attribute',
      detail,
    }));
    const children = error.children?.length
      ? collect(error.children, segment)
      : [];
    return [...own, ...children];
  });
}

export function jsonApiValidationException(
  errors: ValidationError[],
): UnprocessableEntityException {
  return new UnprocessableEntityException({ errors: collect(errors, []) });
}
