/**
 * @file HTTP shapes of projects, members, settings, sources and onboarding, over `@hub/contracts`.
 * @description A source's DTO has `hasSecret` and nothing else about its secret. An arch test checks that
 * no DTO names a stored secret or hash.
 */
import {
  createProjectSchema,
  createSourceSchema,
  githubLoginsSchema,
  memberRowSchema,
  onboardingGroupSchema,
  projectDetailSchema,
  projectListItemSchema,
  projectSchema,
  putSettingSchema,
  settingCatalogueRowSchema,
  settingRowSchema,
  sourceSchema,
  sourceTestResultSchema,
  updateMemberRolesSchema,
  updateProjectSchema,
  updateSourceSchema,
} from '@hub/contracts';
import { createZodDto } from 'nestjs-zod';

import { paginationQuerySchema } from '@/shared/http';

export class CreateProjectDto extends createZodDto(createProjectSchema) {}
export class UpdateProjectDto extends createZodDto(updateProjectSchema) {}
export class UpdateMemberRolesDto extends createZodDto(updateMemberRolesSchema) {}
export class GithubLoginsDto extends createZodDto(githubLoginsSchema) {}
export class PutSettingDto extends createZodDto(putSettingSchema) {}
export class CreateSourceDto extends createZodDto(createSourceSchema) {}
export class UpdateSourceDto extends createZodDto(updateSourceSchema) {}
export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}

export class ProjectDto extends createZodDto(projectSchema) {}
export class ProjectDetailDto extends createZodDto(projectDetailSchema) {}
export class ProjectListItemDto extends createZodDto(projectListItemSchema) {}
export class MemberRowDto extends createZodDto(memberRowSchema) {}
export class SettingRowDto extends createZodDto(settingRowSchema) {}
export class SettingCatalogueRowDto extends createZodDto(settingCatalogueRowSchema) {}
export class SourceDtoHttp extends createZodDto(sourceSchema) {}
export class SourceTestResultDto extends createZodDto(sourceTestResultSchema) {}
export class OnboardingGroupDto extends createZodDto(onboardingGroupSchema) {}
