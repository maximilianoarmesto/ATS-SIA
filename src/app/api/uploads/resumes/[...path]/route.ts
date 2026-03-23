import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const fileName = params.path.join('/')

    // Prevent directory traversal
    if (fileName.includes('..') || fileName.includes('\0')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const filePath = join(process.cwd(), 'public', 'uploads', 'resumes', fileName)

    // Check file exists
    try {
      await stat(filePath)
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const buffer = await readFile(filePath)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('GET /api/uploads/resumes error:', error)
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    )
  }
}
