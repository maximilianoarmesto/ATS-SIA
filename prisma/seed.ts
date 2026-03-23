import { PrismaClient, UserRole, JobStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Create sample users
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

  const regularUser = await prisma.user.upsert({
    where: { email: 'user@ats-sia.com' },
    update: {},
    create: {
      email: 'user@ats-sia.com',
      name: 'John Doe',
      role: UserRole.USER,
    },
  })

  // Create sample jobs
  const job1 = await prisma.job.create({
    data: {
      title: 'Software Engineer',
      description: 'Full-stack developer position with experience in React and Node.js',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      salary: '$80,000 - $120,000',
      status: JobStatus.ACTIVE,
    },
  })

  const job2 = await prisma.job.create({
    data: {
      title: 'Frontend Developer',
      description: 'Frontend developer with expertise in React and TypeScript',
      company: 'Startup Inc',
      location: 'Remote',
      salary: '$70,000 - $100,000',
      status: JobStatus.ACTIVE,
    },
  })

  // Create sample application
  await prisma.application.create({
    data: {
      userId: regularUser.id,
      jobId: job1.id,
      coverLetter: 'I am very interested in this position...',
      notes: 'Applied through company website',
    },
  })

  console.log('Database seeded successfully!')
  console.log('Created users:', { adminUser, recruiterUser, regularUser })
  console.log('Created jobs:', { job1, job2 })
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