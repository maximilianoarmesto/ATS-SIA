export type { User, Job, Application, UserRole, JobStatus, ApplicationStatus } from '@prisma/client'

export interface JobWithApplications extends Job {
  applications: Application[]
  _count?: {
    applications: number
  }
}

export interface ApplicationWithJobAndUser extends Application {
  job: Job
  user: User
}

export interface UserWithApplications extends User {
  applications: ApplicationWithJobAndUser[]
}