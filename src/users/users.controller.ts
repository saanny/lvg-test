import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JsonApiResource } from '../common/json-api/json-api-resource.decorator';
import { UsersService } from './users.service';
import { CreateUserRequest } from './dto/create-user-request.dto';
import { UpdateUserRequest } from './dto/update-user-request.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { Roles } from '../auth/decorators/auth.decorator';

@ApiTags('users')
@ApiBearerAuth()
@JsonApiResource('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() body: CreateUserRequest) {
    this.assertType(body.data.type);
    return this.usersService.create(body.data.attributes);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiQuery({
    name: 'page[number]',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
  })
  @ApiQuery({
    name: 'page[size]',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
  })
  findAll(@Query() query: FindUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: User) {
    return this.usersService.findOneAuthorized(id, actor);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserRequest,
    @CurrentUser() actor: User,
  ) {
    this.assertType(body.data.type);
    if (body.data.id !== undefined && body.data.id !== id) {
      throw new ConflictException('Resource id in the body must match the URL');
    }
    return this.usersService.update(id, body.data.attributes, actor);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: User) {
    return this.usersService.remove(id, actor);
  }

  private assertType(type: string): void {
    if (type !== 'users') {
      throw new ConflictException("Resource type must be 'users'");
    }
  }
}
