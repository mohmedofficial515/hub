/**
 * @file Projects: details, members, settings, sources, GitHub identities, onboarding (docs/12 H0-04).
 * @description Other modules read settings through `SettingsService.value`, and capture adapters read a
 * source's secret through `SourcesService.readSecret`.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '@/modules/audit';
import { CardsModule } from '@/modules/cards';
import { IdentityModule } from '@/modules/identity';

import { MemberRemovalHooks } from './application/member-removal.hooks';
import { MembersService } from './application/members.service';
import { OnboardingService } from './application/onboarding.service';
import { ProjectGate } from './application/project-gate';
import { ProjectsService } from './application/projects.service';
import { SettingsService } from './application/settings.service';
import { SourcesService } from './application/sources.service';
import { MembersController } from './presentation/http/members.controller';
import { OnboardingController } from './presentation/http/onboarding.controller';
import { SettingsController } from './presentation/http/settings.controller';
import { SourcesController } from './presentation/http/sources.controller';
import { WorkspacesController } from './presentation/http/workspaces.controller';

@Module({
  imports: [AuditModule, CardsModule, IdentityModule],
  controllers: [
    WorkspacesController,
    MembersController,
    SettingsController,
    SourcesController,
    OnboardingController,
  ],
  providers: [
    MemberRemovalHooks,
    MembersService,
    OnboardingService,
    ProjectGate,
    ProjectsService,
    SettingsService,
    SourcesService,
  ],
  exports: [MembersService, OnboardingService, ProjectsService, SettingsService, SourcesService],
})
export class WorkspacesModule {}
