export const APP_CONFIG = {
  name: 'ATS - SIA',
  description: 'Applicant Tracking System - Smart Interview Assistant',
  version: '1.0.0',
} as const

export const USER_ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  RECRUITER: 'RECRUITER',
} as const

export const JOB_STATUS = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  DRAFT: 'DRAFT',
} as const

export const APPLICATION_STATUS = {
  PENDING: 'PENDING',
  REVIEWED: 'REVIEWED',
  INTERVIEWING: 'INTERVIEWING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const