import {
  PrismaClient,
  UserRole,
  RoleStatus,
  LocationType,
  EmploymentType,
  ApplicationStatus,
  ApplicationStage,
  CandidateStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // -------------------------------------------------------------------------
  // Users (platform accounts: admins, recruiters, hiring managers)
  // -------------------------------------------------------------------------
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ats-sia.com' },
    update: {},
    create: {
      email: 'admin@ats-sia.com',
      name: 'Admin User',
      role: UserRole.ADMIN,
    },
  })

  const recruiterUser = await prisma.user.upsert({
    where: { email: 'recruiter@ats-sia.com' },
    update: {},
    create: {
      email: 'recruiter@ats-sia.com',
      name: 'Recruiter User',
      role: UserRole.RECRUITER,
    },
  })

  const hiringManager = await prisma.user.upsert({
    where: { email: 'hiring-manager@ats-sia.com' },
    update: {},
    create: {
      email: 'hiring-manager@ats-sia.com',
      name: 'Hiring Manager',
      role: UserRole.HIRING_MANAGER,
    },
  })

  // -------------------------------------------------------------------------
  // Candidates
  // -------------------------------------------------------------------------
  const candidate1 = await prisma.candidate.upsert({
    where: { email: 'alice.johnson@example.com' },
    update: {},
    create: {
      email: 'alice.johnson@example.com',
      firstName: 'Alice',
      lastName: 'Johnson',
      phone: '+1-555-0101',
      linkedinUrl: 'https://linkedin.com/in/alicejohnson',
      location: 'San Francisco, CA',
      summary:
        'Full-stack engineer with 5 years of experience in React and Node.js.',
      status: CandidateStatus.ACTIVE,
    },
  })

  const candidate2 = await prisma.candidate.upsert({
    where: { email: 'bob.smith@example.com' },
    update: {},
    create: {
      email: 'bob.smith@example.com',
      firstName: 'Bob',
      lastName: 'Smith',
      phone: '+1-555-0102',
      location: 'Remote',
      summary:
        'Frontend specialist focused on TypeScript, React, and accessibility.',
      status: CandidateStatus.ACTIVE,
    },
  })

  const candidate3 = await prisma.candidate.upsert({
    where: { email: 'carol.white@example.com' },
    update: {},
    create: {
      email: 'carol.white@example.com',
      firstName: 'Carol',
      lastName: 'White',
      linkedinUrl: 'https://linkedin.com/in/carolwhite',
      portfolioUrl: 'https://carolwhite.dev',
      location: 'New York, NY',
      summary: 'Product designer with a strong background in UX research.',
      status: CandidateStatus.ACTIVE,
    },
  })

  // -------------------------------------------------------------------------
  // Roles (open positions)
  // -------------------------------------------------------------------------
  const role1 = await prisma.role.create({
    data: {
      title: 'Senior Software Engineer',
      description:
        'Join our core platform team building scalable full-stack features using React and Node.js.',
      department: 'Engineering',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      locationType: LocationType.HYBRID,
      employmentType: EmploymentType.FULL_TIME,
      salaryMin: 120000_00, // stored in cents
      salaryMax: 160000_00,
      salaryCurrency: 'USD',
      requirements:
        '5+ years TypeScript, React, Node.js; experience with PostgreSQL; strong communication skills.',
      benefits: 'Health insurance, 401(k), flexible PTO, home-office stipend.',
      status: RoleStatus.PUBLISHED,
      postedById: recruiterUser.id,
      publishedAt: new Date('2024-01-15T09:00:00Z'),
      closesAt: new Date('2024-03-15T23:59:59Z'),
    },
  })

  const role2 = await prisma.role.create({
    data: {
      title: 'Frontend Developer',
      description:
        'Work closely with our design system team to build pixel-perfect, accessible UI components.',
      department: 'Engineering',
      company: 'Startup Inc',
      location: 'Remote',
      locationType: LocationType.REMOTE,
      employmentType: EmploymentType.FULL_TIME,
      salaryMin: 90000_00,
      salaryMax: 120000_00,
      salaryCurrency: 'USD',
      requirements:
        '3+ years React/TypeScript; familiarity with Tailwind CSS; eye for detail.',
      benefits: 'Fully remote, flexible hours, learning budget.',
      status: RoleStatus.PUBLISHED,
      postedById: recruiterUser.id,
      publishedAt: new Date('2024-01-20T09:00:00Z'),
    },
  })

  const role3 = await prisma.role.create({
    data: {
      title: 'Product Designer',
      description:
        'Own end-to-end design for our consumer-facing product from discovery through delivery.',
      department: 'Design',
      company: 'Tech Corp',
      location: 'New York, NY',
      locationType: LocationType.ON_SITE,
      employmentType: EmploymentType.FULL_TIME,
      salaryMin: 100000_00,
      salaryMax: 140000_00,
      salaryCurrency: 'USD',
      requirements:
        '4+ years product design; proficiency in Figma; experience conducting user research.',
      benefits: 'Health insurance, commuter benefits, gym membership.',
      status: RoleStatus.DRAFT,
      postedById: hiringManager.id,
    },
  })

  // -------------------------------------------------------------------------
  // Applications
  // -------------------------------------------------------------------------
  await prisma.application.create({
    data: {
      candidateId: candidate1.id,
      roleId: role1.id,
      status: ApplicationStatus.INTERVIEWING,
      stage: ApplicationStage.INTERVIEW_1,
      coverLetter:
        'I am excited about this opportunity and believe my full-stack experience is a great match.',
      source: 'LinkedIn',
      rating: 4,
    },
  })

  await prisma.application.create({
    data: {
      candidateId: candidate2.id,
      roleId: role2.id,
      status: ApplicationStatus.UNDER_REVIEW,
      stage: ApplicationStage.SCREENING,
      coverLetter: 'Frontend development is my passion and I love Tailwind.',
      source: 'Company website',
    },
  })

  await prisma.application.create({
    data: {
      candidateId: candidate3.id,
      roleId: role3.id,
      status: ApplicationStatus.APPLIED,
      stage: ApplicationStage.APPLICATION,
      source: 'Referral',
    },
  })

  // Alice also applied for the Frontend role
  await prisma.application.create({
    data: {
      candidateId: candidate1.id,
      roleId: role2.id,
      status: ApplicationStatus.SHORTLISTED,
      stage: ApplicationStage.ASSESSMENT,
      coverLetter: 'Happy to apply for the frontend role too!',
      source: 'LinkedIn',
      rating: 5,
    },
  })

  console.log('Database seeded successfully!')
  console.log('Created users:', { adminUser, recruiterUser, hiringManager })
  console.log('Created candidates:', { candidate1, candidate2, candidate3 })
  console.log('Created roles:', { role1, role2, role3 })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
