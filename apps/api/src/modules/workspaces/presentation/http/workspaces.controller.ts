/**
 * @file Project routes (docs/04 §3.4, docs/15 §5). There is no delete: a project closes and reopens.
 */
import type { MemberActor, Principal } from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Actor, CurrentPrincipal, Permissions } from '@/shared/http';

import { ProjectsService } from '../../application/projects.service';
import {
  CreateProjectDto,
  ProjectDetailDto,
  ProjectDto,
  ProjectListItemDto,
  UpdateProjectDto,
} from './workspaces.dto';

@ApiTags('projects')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Permissions('project.read')
  @ApiOperation({ summary: 'The member’s projects, with what is waiting in each' })
  @ApiOkResponse({ type: [ProjectListItemDto] })
  list(@CurrentPrincipal() principal: Principal): Promise<ProjectListItemDto[]> {
    return this.projects.list(principal);
  }

  @Post()
  @HttpCode(201)
  @Permissions('project.create')
  @ApiOperation({ summary: 'Create a project. The creator becomes its owner' })
  @ApiCreatedResponse({ type: ProjectDto })
  create(@CurrentPrincipal() principal: Principal, @Body() body: CreateProjectDto): Promise<ProjectDto> {
    return this.projects.create(principal, body);
  }

  @Get(':ws')
  @Permissions('project.read')
  @ApiOperation({ summary: 'One project with the member’s roles and its counts' })
  @ApiOkResponse({ type: ProjectDetailDto })
  get(@Actor() actor: MemberActor): Promise<ProjectDetailDto> {
    return this.projects.get(actor);
  }

  @Patch(':ws')
  @Permissions('project.update')
  @ApiOperation({ summary: 'Change a project’s details' })
  @ApiOkResponse({ type: ProjectDto })
  update(@Actor() actor: MemberActor, @Body() body: UpdateProjectDto): Promise<ProjectDto> {
    return this.projects.update(actor, body);
  }

  @Post(':ws/close')
  @HttpCode(200)
  @Permissions('project.close')
  @ApiOperation({ summary: 'Close a project. It stays readable and can be reopened' })
  @ApiOkResponse({ type: ProjectDto })
  close(@Actor() actor: MemberActor): Promise<ProjectDto> {
    return this.projects.close(actor);
  }

  @Post(':ws/reopen')
  @HttpCode(200)
  @Permissions('project.reopen')
  @ApiOperation({ summary: 'Reopen a closed project' })
  @ApiOkResponse({ type: ProjectDto })
  reopen(@Actor() actor: MemberActor): Promise<ProjectDto> {
    return this.projects.reopen(actor);
  }
}
