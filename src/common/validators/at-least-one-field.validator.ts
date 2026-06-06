import { registerDecorator, ValidationArguments } from 'class-validator';

export function AtLeastOneField(fields: string[]): ClassDecorator {
  return (target) => {
    registerDecorator({
      name: 'atLeastOneField',
      target: target,
      propertyName: 'atLeastOneField',
      constraints: fields,
      validator: {
        validate: (_value, args: ValidationArguments) =>
          fields.some(
            (field) =>
              (args.object as Record<string, unknown>)[field] !== undefined,
          ),
        defaultMessage: () => `Provide at least one of: ${fields.join(', ')}`,
      },
    });
  };
}
