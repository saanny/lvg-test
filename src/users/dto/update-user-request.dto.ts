import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

class UpdateUserResource {
  @ApiProperty({ example: 'users' })
  @IsString()
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ type: UpdateUserDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateUserDto)
  attributes!: UpdateUserDto;
}

export class UpdateUserRequest {
  @ApiProperty({ type: UpdateUserResource })
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateUserResource)
  data!: UpdateUserResource;
}
