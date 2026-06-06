import { ApiHideProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  number: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size: number = 10;
}

export class PaginationQueryDto {
  @ApiHideProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => PageQueryDto)
  page?: PageQueryDto;
}
