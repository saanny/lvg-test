import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsString, ValidateNested } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

class CreateUserResource {
  @ApiProperty({ example: 'users' })
  @IsString()
  type!: string;

  @ApiProperty({ type: CreateUserDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateUserDto)
  attributes!: CreateUserDto;
}

export class CreateUserRequest {
  @ApiProperty({ type: CreateUserResource })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateUserResource)
  data!: CreateUserResource;
}
