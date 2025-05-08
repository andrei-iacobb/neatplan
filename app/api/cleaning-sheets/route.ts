import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const sheets = await prisma.document.findMany({
      where: {
        type: 'cleaning_sheet',
      },
      include: {
        room: {
          select: {
            name: true,
            building: true,
            floor: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(sheets);
  } catch (error) {
    console.error('Error fetching cleaning sheets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cleaning sheets' },
      { status: 500 }
    );
  }
} 