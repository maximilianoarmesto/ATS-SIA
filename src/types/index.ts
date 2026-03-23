export type {
  User,
  Candidate,
  Role,
  Application,
  // Enums
  UserRole,
  CandidateStatus,
  RoleStatus,
  LocationType,
  EmploymentType,
  ApplicationStatus,
  ApplicationStage,
} from '@prisma/client'

import type {
  User,
  Candidate,
  Role,
  Application,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Composite / extended types used across the application
// ---------------------------------------------------------------------------

export interface RoleWithApplicationCount extends Role {
  _count: {
    applications: number
  }
}

export interface CandidateWithApplicationCount extends Candidate {
  _count: {
    applications: number
  }
}

export interface RoleWithApplications extends Role {
  applications: ApplicationWithCandidate[]
  _count?: {
    applications: number
  }
}

export interface CandidateWithApplications extends Candidate {
  applications: ApplicationWithRole[]
}

export interface ApplicationWithRole extends Application {
  role: Role
}

export interface ApplicationWithCandidate extends Application {
  candidate: Candidate
}

export interface ApplicationWithDetails extends Application {
  candidate: Candidate
  role: Role
}
