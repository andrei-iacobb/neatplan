import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.taskTemplate.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching task templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !isAdmin(session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, category, frequency, priority } = body;

    const template = await prisma.taskTemplate.create({
      data: {
        name,
        description,
        category,
        frequency,
        priority,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error creating task template:', error);
    return NextResponse.json(
      { error: 'Failed to create task template' },
      { status: 500 }
    );
  }
} 